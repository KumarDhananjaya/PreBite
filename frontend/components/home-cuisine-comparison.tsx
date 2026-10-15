"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { api, type CuisineComparison } from "@/lib/api";

export function HomeCuisineComparison({ menuId, dishId, dishName, revision }: {
  menuId: string; dishId: string; dishName: string; revision: string;
}) {
  const { cuisine } = useApp();
  const [result, setResult] = useState<CuisineComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setResult(null);
    api.compareMenuDish(menuId, dishId, cuisine)
      .then((data) => { if (active) setResult(data); })
      .catch(() => { if (active) setResult(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [menuId, dishId, cuisine, revision, attempt]);

  const comparison = result?.home_cuisine === cuisine ? result.comparison : null;
  return (
    <section aria-labelledby="home-comparison-heading" className="mt-8 overflow-hidden rounded-3xl border border-blue-500/20 bg-zinc-900/40">
      <div className="p-6 sm:p-8">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
          <ArrowLeftRight className="h-4 w-4" /> A taste of home · {cuisine}
        </p>
        <h2 id="home-comparison-heading" className="mt-3 text-xl font-bold text-white">Compare with your home cuisine</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">See how {dishName} relates to familiar {cuisine} cooking. Change your home cuisine in the header to explore another perspective.</p>
        {loading ? (
          <p role="status" className="mt-6 flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin text-blue-400" /> Preparing your detailed comparison…</p>
        ) : comparison ? (
          <>
            <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
              <p className="text-xs font-semibold text-blue-300">Food reference from your home cuisine</p>
              <h3 className="mt-2 text-lg font-bold text-white">{comparison.familiar_dish}</h3>
              <p className="mt-2 text-sm leading-7 text-zinc-300">{comparison.summary}</p>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                {[
                  ["About this home dish", comparison.home_description],
                  ["Why it feels familiar", comparison.why_similar],
                  ["What tastes different", comparison.key_difference],
                  ["How it is usually eaten", comparison.serving_style],
                ].map(([label, detail]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-blue-300">{label}</dt>
                    <dd className="mt-2 text-sm leading-7 text-zinc-300">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="mt-5 space-y-3">
              {comparison.rows.map((row) => (
                <div key={row.aspect} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
                  <h3 className="text-sm font-bold text-blue-300">{row.aspect}</h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div><p className="text-xs font-semibold text-zinc-400">{dishName}</p><p className="mt-1 text-sm leading-relaxed text-zinc-200">{row.dish}</p></div>
                    <div><p className="text-xs font-semibold text-zinc-400">{comparison.familiar_dish}</p><p className="mt-1 text-sm leading-relaxed text-zinc-200">{row.home}</p></div>
                  </div>
                  <p className="mt-4 border-t border-zinc-800 pt-3 text-sm leading-relaxed text-zinc-300"><span className="font-semibold text-white">What to expect: </span>{row.difference}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-relaxed text-zinc-500">AI-generated culinary analogy. Recipes vary by region and restaurant; this comparison does not verify ingredients or dietary suitability.</p>
          </>
        ) : (
          <div role="status" className="mt-6 rounded-2xl border border-zinc-800 p-5">
            <p className="text-sm text-zinc-400">Your home-cuisine comparison is currently unavailable.</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500">Try again</button>
          </div>
        )}
      </div>
    </section>
  );
}
