import { create } from "zustand";

interface ThemeState {
  dark: boolean;
  toggle: () => void;
  init: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  dark: false,
  toggle: () => {
    const next = !get().dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("medfinder-theme", next ? "dark" : "light");
    set({ dark: next });
  },
  init: () => {
    const stored = localStorage.getItem("medfinder-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = stored === "dark" || (!stored && prefersDark);
    document.documentElement.classList.toggle("dark", dark);
    set({ dark });
  },
}));
