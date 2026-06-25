import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useStore } from "../../store/useStore";

const ICON = {
  success: <CheckCircle2 size={18} className="text-green-400" />,
  error: <XCircle size={18} className="text-red-400" />,
  info: <Info size={18} className="text-accent" />,
};

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0 sm:items-end">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="card pointer-events-auto flex animate-fade-in items-center gap-2.5 px-4 py-3 text-sm font-medium shadow-xl"
        >
          {ICON[t.kind]}
          <span>{t.message}</span>
        </button>
      ))}
    </div>
  );
}
