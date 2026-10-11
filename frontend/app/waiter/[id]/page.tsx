"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useParams, notFound } from "next/navigation";
import { SpeechButton } from "@/components/speech-button";
import { getDish } from "@/lib/dishes";

export default function WaiterPage() {
  const params = useParams<{ id: string }>();
  const dish = getDish(params.id);
  if (!dish) notFound();
  return <div className="flex min-h-[calc(100vh-104px)] items-center bg-white px-5 py-10 text-zinc-950"><div className="mx-auto w-full max-w-2xl"><Link href={`/dish/${dish.id}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-950"><ArrowLeft className="h-3.5 w-3.5" /> Back to dish</Link><div className="mt-14 border-y border-zinc-200 py-10 text-center sm:py-16"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-zinc-400">Please show to your waiter</p><h1 className="mt-7 text-4xl font-semibold leading-[1.1] tracking-[-.05em] sm:text-5xl">{dish.waiterText}</h1><p className="mt-7 text-base text-zinc-500">“{dish.waiterTranslation}”</p></div><div className="mx-auto mt-8 max-w-md"><SpeechButton text={dish.waiterText} label="Speak Out Loud" large /></div></div></div>;
}
