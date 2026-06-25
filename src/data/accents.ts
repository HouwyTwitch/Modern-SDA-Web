import type { AccentColor } from "../types";

export const ACCENTS: AccentColor[] = [
  { id: "blue", label: "Blue", rgb: "26 159 255" },
  { id: "purple", label: "Purple", rgb: "168 85 247" },
  { id: "green", label: "Green", rgb: "34 197 94" },
  { id: "orange", label: "Orange", rgb: "245 158 11" },
  { id: "pink", label: "Pink", rgb: "236 72 153" },
  { id: "red", label: "Red", rgb: "239 68 68" },
  { id: "teal", label: "Teal", rgb: "20 184 166" },
];

export function accentById(id: string): AccentColor {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}
