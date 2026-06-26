import { useEffect, useRef, useState } from "react";
import { Camera, Check, X, Loader2, ClipboardPaste } from "lucide-react";
import jsQR from "jsqr";
import { Modal } from "../common/Modal";
import { useStore } from "../../store/useStore";
import type { Account } from "../../types";

interface Props {
  account: Account;
  open: boolean;
  onClose: () => void;
}

/** Decode a QR code from any image source using jsQR (pure JS, all browsers). */
function decodeFromSource(source: CanvasImageSource, w: number, h: number): string | null {
  if (!w || !h) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return jsQR(data, w, h)?.data ?? null;
}

export function QrApproveModal({ account, open, onClose }: Props) {
  const qrApprove = useStore((s) => s.qrApprove);
  const pushToast = useStore((s) => s.pushToast);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>();

  async function decodeImage(blob?: Blob | null) {
    if (!blob) return;
    setError(undefined);
    try {
      const bitmap = await createImageBitmap(blob);
      const result = decodeFromSource(bitmap, bitmap.width, bitmap.height);
      bitmap.close?.();
      if (result) {
        setUrl(result);
        pushToast("QR loaded from image", "success");
      } else {
        setError("No QR code found in the image.");
      }
    } catch {
      setError("Could not read the image.");
    }
  }

  /** Read an image (or a link) directly from the clipboard. */
  async function pasteFromClipboard() {
    setError(undefined);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find((t) => t.startsWith("image/"));
        if (imgType) {
          await decodeImage(await item.getType(imgType));
          return;
        }
      }
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setUrl(text.trim());
        return;
      }
      setError("No image or link found in the clipboard.");
    } catch {
      setError("Clipboard blocked — paste into the field with Ctrl/Cmd+V instead.");
    }
  }

  function stopScan() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => {
    if (!open) {
      stopScan();
      setUrl("");
      setError(undefined);
    }
    return stopScan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function startScan() {
    setError(undefined);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera needs a secure (https) connection. Paste the QR image or link instead.");
      return;
    }
    try {
      // Acquire the stream first; the <video> is attached in the effect below
      // once React has actually mounted it (avoids a null-ref race on mobile).
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
    } catch (e) {
      const name = (e as DOMException)?.name;
      setError(
        name === "NotAllowedError"
          ? "Camera permission was denied."
          : "Could not access the camera. Paste the QR image or link instead.",
      );
      stopScan();
    }
  }

  // Attach the acquired stream to the video element after it mounts, then scan.
  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    let cancelled = false;
    video.srcObject = stream;

    const tick = () => {
      if (cancelled || !streamRef.current || !videoRef.current) return;
      const v = videoRef.current;
      const result = decodeFromSource(v, v.videoWidth, v.videoHeight);
      if (result) {
        setUrl(result);
        pushToast("QR detected", "success");
        stopScan();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    video
      .play()
      .catch(() => {
        /* autoplay quirks — scanning still works once frames arrive */
      })
      .finally(() => {
        if (!cancelled) rafRef.current = requestAnimationFrame(tick);
      });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  async function act(confirm: boolean) {
    setError(undefined);
    setBusy(true);
    try {
      await qrApprove(account.id, url.trim(), confirm);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Approve QR login">
      <p className="mb-4 text-sm text-ink-muted">
        Paste the Steam QR challenge — a screenshot/copied image of the QR, or the link itself —
        shown on the device you're signing in on.
      </p>

      {scanning ? (
        <div className="overflow-hidden rounded-xl border border-line">
          <video ref={videoRef} className="aspect-square w-full bg-black object-cover" muted playsInline />
        </div>
      ) : (
        <textarea
          className="input min-h-[88px] resize-none font-mono text-xs"
          placeholder="Paste a QR image (Ctrl/Cmd+V) or the challenge link here…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={(e) => {
            const img = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
            if (img) {
              e.preventDefault();
              void decodeImage(img.getAsFile());
            }
          }}
        />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button onClick={pasteFromClipboard} className="btn-ghost !px-2 text-xs text-accent">
          <ClipboardPaste size={14} /> Paste image from clipboard
        </button>
        <button onClick={scanning ? stopScan : startScan} className="btn-ghost !px-2 text-xs text-accent">
          <Camera size={14} /> {scanning ? "Stop camera" : "Scan with camera"}
        </button>
        <span className="ml-auto text-xs text-ink-faint">{account.name}</span>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button onClick={() => void act(false)} disabled={busy || !url.trim()} className="btn-danger flex-1">
          <X size={16} /> Deny
        </button>
        <button onClick={() => void act(true)} disabled={busy || !url.trim()} className="btn-accent flex-1">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Approve
        </button>
      </div>
    </Modal>
  );
}
