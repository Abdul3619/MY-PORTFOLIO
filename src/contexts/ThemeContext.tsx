import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = "app_theme";
// The server cannot know a visitor's saved preference, so the server render and the first browser render
// both use this default. The saved choice is applied after hydration.
export const DEFAULT_THEME: Theme = "dark";

const defaultThemeContext: ThemeContextType = {
  theme: DEFAULT_THEME,
  isDark: DEFAULT_THEME === "dark",
  setTheme: () => {},
  toggleTheme: () => {},
};

const ThemeContext = createContext<ThemeContextType>(defaultThemeContext);

function readSavedTheme(): Theme | null {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null; // storage blocked (private mode, sandboxed iframe)
  }
}

function saveTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage write errors (e.g. private browsing quota)
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove(theme === "light" ? "dark" : "light");
  root.classList.add(theme);
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

// SSR-safe: nothing here touches window, document or localStorage during render or at module load.
// Browser-only work happens in effects and event handlers, which never run on the server.
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  // After hydration, switch to the visitor's saved preference (if any).
  useEffect(() => {
    const saved = readSavedTheme();
    if (saved) setThemeState(saved);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    // Lets non-React code follow theme changes
    window.dispatchEvent(new CustomEvent("app-theme-change", { detail: { theme } }));
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    saveTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      saveTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, isDark: theme === "dark", setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Safe to call anywhere, including outside the provider (returns the default theme instead of throwing,
// so a missing provider can never crash the server render).
export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
