import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface Props {
  code: string;
  size?: "md" | "lg" | "xl";
  onCopy?: () => void;
}

const SIZES = {
  md: "text-2xl",
  lg: "text-3xl",
  xl: "text-5xl",
};

/** The big mono Steam Guard code; click/tap to copy. */
export function CodeDisplay({ code, size = "md", onCopy }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <button
      onClick={copy}
      title="Copy code"
      className="group inline-flex items-center gap-2 font-mono font-bold tracking-[0.18em] text-accent transition active:scale-95"
    >
      <span className={SIZES[size]}>
        {code.split("").map((ch, i) => (
          <span key={i} className={i === 2 ? "ml-1.5" : ""}>
            {ch}
          </span>
        ))}
      </span>
      <span className="text-ink-faint opacity-0 transition group-hover:opacity-100">
        {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
      </span>
    </button>
  );
}
