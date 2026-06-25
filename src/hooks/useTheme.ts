import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { accentById } from "../data/accents";

/** Applies the selected theme class + accent color to <html>, reacting live. */
export function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  const accent = useStore((s) => s.settings.accent);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.classList.remove("dark", "light", "contrast");
      let effective = theme;
      if (theme === "system") {
        effective = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      root.classList.add(effective);
    };
    apply();

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accentById(accent).rgb);
  }, [accent]);
}
