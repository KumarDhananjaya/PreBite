"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, ShieldAlert } from "lucide-react";
import { SensoryMeter } from "@/components/sensory-meter";
import { SpeechButton } from "@/components/speech-button";
import { useApp } from "@/components/app-provider";
import { localeForCuisine } from "@/lib/cuisines";
import { api } from "@/lib/api";
import {
  fromApiDish,
  isScannedDishId,
  readScannedDish,
  type Dish,
} from "@/lib/dishes";
import { useEffect, useState } from "react";

export default function DishPage() {
  const params = useParams<{ id: string }>();
  const { cuisine } = useApp();
  const homeLocale = localeForCuisine(cuisine);
  const [dish, setDish] = useState<Dish | null>(null);

  useEffect(() => {
    let isActive = true;
    setDish(null);

    if (isScannedDishId(params.id)) {
      const scannedDish = readScannedDish(params.id);
      if (scannedDish && isActive) {
        setDish(scannedDish);
      } else if (isActive) {
        setDish(null);
      }
      return () => {
        isActive = false;
      };
    }

    api
      .dish(params.id)
      .then((source) =>
        api
          .tasteBridge(params.id, cuisine)
          .then((bridge) => {
            if (isActive) setDish(fromApiDish(source, bridge));
          })
          .catch(() => {
            if (isActive) setDish(fromApiDish(source));
          }),
      )
      .catch(() => {
        if (isActive) setDish(null);
      });

    return () => {
      isActive = false;
    };
  }, [params.id, cuisine]);

  if (!dish) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 pb-28 sm:px-6 sm:py-14">
        <Link
          href="/menu/upload"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to menu upload
        </Link>
        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-300">
          Loading dish details from the scanned result…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-28 sm:px-6 sm:py-14">
      <Link
        href="/menu/upload"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to menu upload
      </Link>
      <div className="mt-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            {dish.name}
          </h1>
          <div className="mt-4 inline-flex rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-400">
            🗣️ Your pronunciation · {dish.phonetic}
          </div>
          <p className="mt-3 text-sm text-zinc-500">{dish.literal}</p>
        </div>
        <SpeechButton
          text={dish.phonetic}
          locale={homeLocale}
          label={`Hear it in ${cuisine}`}
        />
      </div>
      {dish.photo && (
        <img
          src={dish.photo}
          alt={dish.name}
          className="mt-8 h-52 w-full rounded-2xl border border-zinc-800 object-cover sm:h-72"
        />
      )}
      <div
        className={`mt-5 flex gap-3 rounded-xl border p-4 ${dish.safe ? "border-emerald-500/25 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}
      >
        {dish.safe ? (
          <Check className="h-5 w-5 shrink-0 text-emerald-400" />
        ) : (
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-400" />
        )}
        <div>
          <p
            className={`text-sm font-semibold ${dish.safe ? "text-emerald-200" : "text-red-200"}`}
          >
            {dish.safe
              ? "Safe for your No Pork profile"
              : `Dietary alert: ${dish.warning}`}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {dish.safe
              ? "No conflict detected in the traditional recipe."
              : "Traditional preparation includes cured pork jowl."}
          </p>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-400">
          Taste bridge · {cuisine}
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          {dish.analogy}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300">
          {dish.technique}
        </p>
        <div className="mt-5 rounded-xl bg-zinc-950/70 p-4 text-sm text-zinc-300">
          <span className="mr-2">👅</span>
          <b className="text-white">Mouthfeel:</b> {dish.mouthfeel}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-500">
              Familiarity
            </p>
            <div className="mt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-white">
                  {dish.familiarity}
                </span>
                <span className="text-xs text-zinc-400">%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300"
                  style={{ width: `${dish.familiarity}%` }}
                />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-500">
              Best pairing
            </p>
            <p className="mt-3 text-sm text-zinc-200">{dish.waiterText}</p>
            <p className="mt-2 text-xs text-zinc-500">
              {dish.waiterTranslation}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-500">
              Confidence
            </p>
            <p className="mt-3 text-sm text-zinc-200">
              {Math.round((dish.confidence ?? 0.82) * 100)}%
            </p>
          </div>
        </div>
        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-500">
            Sensory meter
          </p>
          <div className="mt-4">
            <SensoryMeter
              icon="🌶️"
              label="Heat"
              value={dish.heat}
              color="bg-rose-500"
            />
            <SensoryMeter
              icon="🧈"
              label="Richness"
              value={dish.richness}
              color="bg-amber-500"
            />
            <SensoryMeter
              icon="🧂"
              label="Salt"
              value={dish.salt}
              color="bg-sky-500"
            />
            <SensoryMeter
              icon="🍲"
              label="Umami"
              value={dish.umami}
              color="bg-emerald-500"
            />
          </div>
        </div>
      </section>

      <div className="mt-8">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-500">
          Dish story
        </p>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          {dish.story ?? dish.literal}
        </p>
      </div>
    </div>
  );
}
