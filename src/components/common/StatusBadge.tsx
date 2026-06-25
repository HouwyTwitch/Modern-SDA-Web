import type { AccountStatus } from "../../types";

const MAP: Record<AccountStatus, { label: string; dot: string; text: string }> = {
  online: { label: "Online", dot: "bg-green-500", text: "text-green-400" },
  expiring: { label: "Session expires soon", dot: "bg-amber-500", text: "text-amber-400" },
  needs_login: { label: "Login required", dot: "bg-red-500", text: "text-red-400" },
  offline: { label: "Offline", dot: "bg-ink-faint", text: "text-ink-faint" },
};

export function StatusBadge({ status }: { status: AccountStatus }) {
  const s = MAP[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
