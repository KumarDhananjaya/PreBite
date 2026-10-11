"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, ShieldAlert } from "lucide-react";
import { SensoryMeter } from "@/components/sensory-meter";
import { SpeechButton } from "@/components/speech-button";
import { getDish } from "@/lib/dishes";
import { useApp } from "@/components/app-provider";
import { localeForCuisine } from "@/lib/cuisines";
import { api } from "@/lib/api";
import { dishes, fromApiDish } from "@/lib/dishes";
import { useEffect, useState } from "react";

export default function DishPage() {
  const params = useParams<{ id: string }>();
  const { cuisine } = useApp();
  const homeLocale = localeForCuisine(cuisine);
  const [dish, setDish] = useState(() => getDish(params.id) ?? dishes[0]);
  useEffect(() => {
    api.dish(params.id).then((source) => api.tasteBridge(params.id, cuisine).then((bridge) => setDish(fromApiDish(source, bridge))).catch(() => setDish(fromApiDish(source)))).catch(() => undefined);
  }, [params.id, cuisine]);
  return <div className="mx-auto max-w-3xl px-4 py-8 pb-28 sm:px-6 sm:py-14"><Link href="/scan" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-200"><ArrowLeft className="h-3.5 w-3.5" /> Back to menu</Link><div className="mt-8 flex items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">{dish.name}</h1><div className="mt-4 inline-flex rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-400">🗣️ Your pronunciation · {dish.phonetic}</div><p className="mt-3 text-sm text-zinc-500">{dish.literal}</p></div><SpeechButton text={dish.phonetic} locale={homeLocale} label={`Hear it in ${cuisine}`} /></div><img src={dish.photo} alt={dish.name} className="mt-8 h-52 w-full rounded-2xl border border-zinc-800 object-cover sm:h-72" /><div className={`mt-5 flex gap-3 rounded-xl border p-4 ${dish.safe ? "border-emerald-500/25 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}>{dish.safe ? <Check className="h-5 w-5 shrink-0 text-emerald-400" /> : <ShieldAlert className="h-5 w-5 shrink-0 text-red-400" />}<div><p className={`text-sm font-semibold ${dish.safe ? "text-emerald-200" : "text-red-200"}`}>{dish.safe ? "Safe for your No Pork profile" : `Dietary alert: ${dish.warning}`}</p><p className="mt-1 text-xs text-zinc-400">{dish.safe ? "No conflict detected in the traditional recipe." : "Traditional preparation includes cured pork jowl."}</p></div></div><section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-400">Taste bridge · {cuisine}</p><h2 className="mt-3 text-2xl font-semibold text-white">{dish.analogy}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300">{dish.technique}</p><div className="mt-5 rounded-xl bg-zinc-950/70 p-4 text-sm text-zinc-300"><span className="mr-2">👅</span><b className="text-white">Mouthfeel:</b> {dish.mouthfeel}</div></section><section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-500">Sensory profile</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><SensoryMeter icon="🌶️" label="Heat" value={dish.heat} color="bg-red-500" /><SensoryMeter icon="🧈" label="Richness" value={dish.richness} color="bg-amber-400" /><SensoryMeter icon="🧂" label="Salt / Brine" value={dish.salt} color="bg-cyan-400" /><SensoryMeter icon="🍄" label="Umami" value={dish.umami} color="bg-violet-400" /></div></section><div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/90 p-3 backdrop-blur"><div className="mx-auto max-w-3xl"><Link href={`/waiter/${dish.id}`} className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[.99]">Show Waiter Card</Link></div></div></div>;
}
