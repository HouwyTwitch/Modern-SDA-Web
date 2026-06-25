import { create } from "zustand";
import type { Settings, ThemeMode } from "../types";

const KEY = "msda.settings.v2";

const DEFAULT: Settings = { theme: "dark", accent: "blue", density: "comfortable" };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT;
}

interface SettingsState extends Settings {
  setTheme: (t: ThemeMode) => void;
  setAccent: (a: string) => void;
  setDensity: (d: Settings["density"]) => void;
}

export const useSettings = create<SettingsState>((set, get) => {
  const persist = () => {
    const { theme, accent, density } = get();
    localStorage.setItem(KEY, JSON.stringify({ theme, accent, density }));
  };
  return {
    ...load(),
    setTheme: (theme) => {
      set({ theme });
      persist();
    },
    setAccent: (accent) => {
      set({ accent });
      persist();
    },
    setDensity: (density) => {
      set({ density });
      persist();
    },
  };
});
