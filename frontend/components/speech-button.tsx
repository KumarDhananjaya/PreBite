"use client";

import { Volume2 } from "lucide-react";

export function speak(text: string, locale = "it-IT") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

export function SpeechButton({ text, label = "Play Italian audio", large = false, locale = "it-IT" }: { text: string; label?: string; large?: boolean; locale?: string }) {
  return <button onClick={() => speak(text, locale)} className={large ? "flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[.98]" : "grid h-10 w-10 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:border-blue-500 hover:text-blue-300"} aria-label={label}>{large && "🔊 "}<Volume2 className="h-4 w-4" />{large && label}</button>;
}
