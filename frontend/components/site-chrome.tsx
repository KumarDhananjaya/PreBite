"use client";

import Link from "next/link";
import { Moon, Search, ShieldAlert, Sun, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { cuisineByName, cuisines } from "@/lib/cuisines";

export function Header() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { cuisine, setCuisine, user, signOut, theme, toggleTheme } = useApp();
  const selected = cuisineByName(cuisine);
  const filtered = cuisines.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.region.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <header className="border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-sm font-bold tracking-tight text-white"
          >
            PreBite
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-600"
            >
              {selected.flag}{" "}
              <span className="max-w-24 truncate sm:max-w-none">{cuisine}</span>
            </button>
            <span className="hidden items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-300 sm:flex">
              <ShieldAlert className="h-3.5 w-3.5" /> No Pork
            </span>
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="grid h-8 w-8 place-items-center rounded-full border border-zinc-800 text-zinc-400 md:hidden"
            >
              {theme === "dark" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <nav className="hidden items-center gap-4 text-xs text-zinc-400 md:flex">
            <Link href="/" className="hover:text-white">
              Explore
            </Link>
            <Link
              href="/menu/upload"
              className="hover:text-white font-medium text-blue-400"
            >
              Upload Menu
            </Link>
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="grid h-8 w-8 place-items-center rounded-full border border-zinc-800 text-zinc-400 transition hover:border-zinc-600 hover:text-white"
            >
              {theme === "dark" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>
            {user ? (
              <button
                onClick={signOut}
                className="rounded-full border border-zinc-800 px-2.5 py-1.5 text-zinc-300 hover:border-zinc-600 hover:text-white"
              >
                {user.name} · Sign out
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-full border border-zinc-700 px-2.5 py-1.5 text-zinc-200 hover:border-zinc-500 hover:text-white"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose home cuisine"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-white">Your home cuisine</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Choose the flavor language you know best.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-5 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-zinc-500">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search cuisine or region"
                autoFocus
                className="h-11 w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
              />
            </label>
            <div className="mt-4 max-h-[52vh] overflow-y-auto pr-1">
              <div className="grid gap-1 sm:grid-cols-2">
                {filtered.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      setCuisine(item.name);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ${item.name === cuisine ? "bg-blue-500/15 text-blue-200" : "text-zinc-300 hover:bg-zinc-900"}`}
                  >
                    <span className="text-lg">{item.flag}</span>
                    <span>
                      <span className="block text-sm font-medium">
                        {item.name}
                      </span>
                      <span className="block text-[10px] text-zinc-600">
                        {item.region}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-zinc-500">
                  No cuisine found.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-4 py-6 text-center text-[10px] leading-4 text-zinc-600 sm:px-6">
      PreBite uses recipe inference and ingredient dictionary validation.
      Confirm severe allergies and dietary requirements with restaurant staff.
    </footer>
  );
}
