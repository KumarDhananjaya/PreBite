"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

type AppUser = { id: string; name: string; email: string };
type AppState = {
  cuisine: string;
  setCuisine: (cuisine: string) => void;
  user: AppUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [cuisine, setCuisine] = useState("North Indian");
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("PreBite-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
    const savedToken = window.localStorage.getItem("prebite-token");
    if (!savedToken) return;
    api.me(savedToken).then((profile) => {
      setToken(savedToken);
      setUser({ id: profile.id, name: profile.name, email: profile.email });
      if (profile.home_cuisine) setCuisine(profile.home_cuisine);
    }).catch(() => window.localStorage.removeItem("prebite-token"));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("PreBite-theme", theme);
  }, [theme]);

  const saveSession = (response: Awaited<ReturnType<typeof api.login>>) => {
    window.localStorage.setItem("prebite-token", response.access_token);
    setToken(response.access_token);
    setUser({ id: response.user.id, name: response.user.name, email: response.user.email });
    if (response.user.home_cuisine) setCuisine(response.user.home_cuisine);
  };
  const signIn = async (email: string, password: string) => saveSession(await api.login(email, password));
  const signUp = async (name: string, email: string, password: string) => saveSession(await api.register(name, email, password));
  const signOut = () => { window.localStorage.removeItem("prebite-token"); setToken(null); setUser(null); };
  const setProfileCuisine = (nextCuisine: string) => {
    setCuisine(nextCuisine);
    if (token) api.updateProfile(token, { home_cuisine: nextCuisine }).catch(() => undefined);
  };
  const toggleTheme = () => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark");

  return <AppContext.Provider value={{ cuisine, setCuisine: setProfileCuisine, user, signIn, signUp, signOut, theme, toggleTheme }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
