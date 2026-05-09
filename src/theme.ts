import type { ThemeMode } from "./types";

export type Palette = {
  background: string;
  backgroundSoft: string;
  panel: string;
  panelStrong: string;
  border: string;
  text: string;
  textMuted: string;
  textSoft: string;
  primary: string;
  primaryStrong: string;
  primaryText: string;
  editorSurface: string;
  editorLine: string;
  chip: string;
  success: string;
};

export const palettes: Record<ThemeMode, Palette> = {
  light: {
    background: "#faf9f5",
    backgroundSoft: "#f3ede3",
    panel: "#fffdf9",
    panelStrong: "#efe9de",
    border: "#d9d1c6",
    text: "#141413",
    textMuted: "#3d3d3a",
    textSoft: "#6c6a64",
    primary: "#cc785c",
    primaryStrong: "#a9583e",
    primaryText: "#ffffff",
    editorSurface: "#fffdf9",
    editorLine: "rgba(217, 209, 198, 0.45)",
    chip: "#f1ebe2",
    success: "#5db872",
  },
  dark: {
    background: "#151412",
    backgroundSoft: "#1b1917",
    panel: "#1f1d1b",
    panelStrong: "#262320",
    border: "#37322e",
    text: "#f4f0ea",
    textMuted: "#ddd4ca",
    textSoft: "#a09d96",
    primary: "#cc785c",
    primaryStrong: "#de8e72",
    primaryText: "#ffffff",
    editorSurface: "#1a1917",
    editorLine: "rgba(160, 157, 150, 0.15)",
    chip: "#25211f",
    success: "#5db872",
  },
  sepia: {
    background: "#f1e7d7",
    backgroundSoft: "#eadbc4",
    panel: "#fcf5ea",
    panelStrong: "#eadbc4",
    border: "#d2c0a4",
    text: "#2d251d",
    textMuted: "#4f4335",
    textSoft: "#7a6c5d",
    primary: "#b96b53",
    primaryStrong: "#96513c",
    primaryText: "#ffffff",
    editorSurface: "#fff8ec",
    editorLine: "rgba(210, 192, 164, 0.45)",
    chip: "#f2e5d1",
    success: "#5d8c61",
  },
};
