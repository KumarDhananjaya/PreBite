"use client";

import { createContext, useContext, useEffect, useState } from "react";

type AppState = {
  cuisine: string;
  setCuisine: (cuisine: string) => void;
  user: { name: string; email: string } | null;
  signIn: (name: string, email: string) => void;
  signOut: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
};
const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [cuisine, setCuisine] = useState("North Indian");
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const savedTheme = window.localStorage.getItem("forkcast-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("forkcast-theme", theme);
  }, [theme]);
  const signIn = (name: string, email: string) => setUser({ name, email });
  const signOut = () => setUser(null);
  const toggleTheme = () => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark");
  return <AppContext.Provider value={{ cuisine, setCuisine, user, signIn, signOut, theme, toggleTheme }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
