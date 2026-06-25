import { type ReactNode } from "react";
import { Palette, Sun, LogOut, User } from "lucide-react";
import { useSettings } from "../store/useSettings";
import { useAuth } from "../store/useAuth";
import { useStore } from "../store/useStore";
import { ACCENTS } from "../data/accents";
import type { ThemeMode } from "../types";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-faint">{title}</h2>
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children?: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-ink-muted">
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2 text-sm text-ink-muted">{children}</span>
    </div>
  );
}

export function SettingsPage() {
  const { theme, accent, setTheme, setAccent } = useSettings();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const reset = useStore((s) => s.reset);

  const themes: { id: ThemeMode; label: string }[] = [
    { id: "system", label: "System" },
    { id: "dark", label: "Dark" },
    { id: "light", label: "Light" },
    { id: "contrast", label: "Contrast" },
  ];

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>

      <Section title="Account">
        <Row icon={<User size={18} />} label="Signed in as">
          {user?.email}
        </Row>
        <button
          onClick={async () => {
            await logout();
            reset();
          }}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-red-500/5"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-400">
            <LogOut size={18} />
          </span>
          <span className="flex-1 text-sm font-medium text-red-400">Sign out</span>
        </button>
      </Section>

      <Section title="Appearance">
        <div className="px-4 py-3.5">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-sunken text-ink-muted">
              <Sun size={18} />
            </span>
            <span className="text-sm font-medium">Theme</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`rounded-xl border py-2 text-xs font-semibold transition ${
                  theme === t.id ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-3.5">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-sunken text-ink-muted">
              <Palette size={18} />
            </span>
            <span className="text-sm font-medium">Accent Color</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccent(a.id)}
                className={`grid h-9 w-9 place-items-center rounded-full transition ${
                  accent === a.id ? "ring-2 ring-offset-2 ring-offset-surface-raised" : ""
                }`}
                style={{
                  backgroundColor: `rgb(${a.rgb})`,
                  ...(accent === a.id ? { ["--tw-ring-color" as string]: `rgb(${a.rgb})` } : {}),
                }}
                aria-label={a.label}
              >
                {accent === a.id && <span className="text-white">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <p className="mt-8 text-center text-xs text-ink-faint">Modern SDA Web v2.0.0</p>
    </div>
  );
}
