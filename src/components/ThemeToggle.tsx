"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "soft-study-theme";

const applyTheme = (mode: ThemeMode) => {
  document.documentElement.setAttribute("data-theme", mode);
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      applyTheme(saved);
      return;
    }

    const preferDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme: ThemeMode = preferDark ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed right-4 top-4 z-50 rounded-2xl border border-[var(--ui-line)] bg-[var(--ui-sidebar)] px-3 py-2 text-sm shadow-sm hover:bg-[var(--ui-hover)]"
      aria-label="テーマを切り替え"
      title="テーマ切替"
    >
      {theme === "light" ? "🌙 ダーク" : "☀️ ライト"}
    </button>
  );
}
