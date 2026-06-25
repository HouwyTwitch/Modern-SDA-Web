import { useEffect, useRef, useState } from "react";
import { QrCode, Camera, Check, X, Loader2 } from "lucide-react";
import { Modal } from "../common/Modal";
import { useStore } from "../../store/useStore";
import type { Account } from "../../types";

interface Props {
  account: Account;
  open: boolean;
  onClose: () => void;
}

// BarcodeDetector is available in Chromium-based browsers; we degrade gracefully.
type BD = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export function QrApproveModal({ account, open, onClose }: Props) {
  const qrApprove = useStore((s) => s.qrApprove);
  const pushToast = useStore((s) => s.pushToast);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cameraSupported = typeof window !== "undefined" && "BarcodeDetector" in window;

  function stopScan() {
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // @ts-expect-error BarcodeDetector is not yet in TS DOM lib
      const detector: BD = new window.BarcodeDetector({ formats: ["qr_code"] });
      const loop = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            setUrl(codes[0].rawValue);
            pushToast("QR detected", "success");
            stopScan();
            return;
          }
        } catch {
          /* frame not ready */
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch {
      setError("Could not access camera. Paste the challenge URL instead.");
      setScanning(false);
    }
  }

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
        Scan or paste the Steam QR challenge shown on the device you're signing in on. This account's
        authenticator will approve the login.
      </p>

      {scanning ? (
        <div className="overflow-hidden rounded-xl border border-line">
          <video ref={videoRef} className="aspect-square w-full bg-black object-cover" muted playsInline />
        </div>
      ) : (
        <textarea
          className="input min-h-[88px] resize-none font-mono text-xs"
          placeholder="steammobile://… or https://s.team/q/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      )}

      <div className="mt-2 flex items-center justify-between">
        {cameraSupported ? (
          <button
            onClick={scanning ? stopScan : startScan}
            className="btn-ghost !px-2 text-xs text-accent"
          >
            <Camera size={14} /> {scanning ? "Stop camera" : "Scan with camera"}
          </button>
        ) : (
          <span className="text-xs text-ink-faint">Camera scanning needs a Chromium browser</span>
        )}
        <span className="text-xs text-ink-faint">{account.name}</span>
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

      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
        <QrCode size={12} /> The challenge is signed with this account's shared secret.
      </p>
    </Modal>
  );
}
