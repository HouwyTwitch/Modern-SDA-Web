import { CODE_PERIOD } from "../../lib/steamGuard";

interface Props {
  remaining: number;
  size?: number;
  label?: boolean;
}

/** Circular countdown ring used next to each Steam Guard code. */
export function CountdownRing({ remaining, size = 44, label = true }: Props) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = remaining / CODE_PERIOD;
  const offset = c * (1 - pct);
  const urgent = remaining <= 5;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--line))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? "#ef4444" : "rgb(var(--accent))"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.3s linear, stroke 0.3s" }}
        />
      </svg>
      {label && (
        <span
          className={`absolute text-xs font-bold tabular-nums ${
            urgent ? "text-red-400" : "text-ink-muted"
          }`}
        >
          {remaining}s
        </span>
      )}
    </div>
  );
}
