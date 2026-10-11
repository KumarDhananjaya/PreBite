"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Edit3,
  HelpCircle,
  Info,
  Loader2,
  ShieldAlert,
  Sparkles,
  Utensils,
  Volume2,
  X,
} from "lucide-react";
import { api, type ApiMenuDish, type DishExplanation } from "@/lib/api";

export default function DishDetailPage() {
  const params = useParams<{ id: string; dishId: string }>();
  const router = useRouter();
  const menuId = params.id;
  const dishId = params.dishId;

  const [dish, setDish] = useState<ApiMenuDish | null>(null);
  const [explanation, setExplanation] = useState<DishExplanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [explaining, setExplaining] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Edit Modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    price: "",
    currency: "$",
    category: "",
    dietaryLabels: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Load basic dish info and explanation
  useEffect(() => {
    if (!menuId || !dishId) return;

    let mounted = true;

    const fetchAll = async () => {
      try {
        setLoading(true);
        const dishData = await api.getMenuDish(menuId, dishId);
        if (!mounted) return;
        setDish(dishData);
        setEditForm({
          name: dishData.name || "",
          description: dishData.description || "",
          price: dishData.price !== null && dishData.price !== undefined ? String(dishData.price) : "",
          currency: dishData.currency || "$",
          category: dishData.category || "",
          dietaryLabels: (dishData.dietary_labels || []).join(", "),
        });
        setLoading(false);

        // Fetch AI Explanation
        setExplaining(true);
        try {
          const exp = await api.explainMenuDish(menuId, dishId);
          if (mounted) setExplanation(exp);
        } catch {
          // Gracefully continue without AI explanation if service unavailable
        } finally {
          if (mounted) setExplaining(false);
        }
      } catch (err) {
        if (!mounted) return;
        setErrorNotice(err instanceof Error ? err.message : "Failed to load dish details.");
        setLoading(false);
        setExplaining(false);
      }
    };

    fetchAll();

    return () => {
      mounted = false;
    };
  }, [menuId, dishId]);

  const handleSaveEdit = async () => {
    if (!dish) return;
    try {
      setSavingEdit(true);
      const numericPrice = editForm.price.trim() ? parseFloat(editForm.price) : null;
      const parsedDietary = editForm.dietaryLabels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const updated = await api.patchMenuDish(menuId, dish.id, {
        name: editForm.name.trim() || dish.name,
        description: editForm.description.trim() || null,
        price: numericPrice,
        currency: editForm.currency.trim() || "$",
        category: editForm.category.trim() || null,
        dietary_labels: parsedDietary,
      });

      setDish(updated);
      setEditOpen(false);

      // Re-trigger explanation with refreshed data
      setExplaining(true);
      api
        .explainMenuDish(menuId, dish.id)
        .then((exp) => setExplanation(exp))
        .catch(() => undefined)
        .finally(() => setExplaining(false));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save dish corrections.");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        <p className="mt-3 text-sm font-semibold text-white">Loading dish record...</p>
      </main>
    );
  }

  if (errorNotice || !dish) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
          <h2 className="mt-3 text-lg font-bold text-white">Dish Not Found</h2>
          <p className="mt-1 text-xs text-zinc-400">{errorNotice || "This dish does not exist on this menu."}</p>
          <Link
            href={`/menu/${menuId}`}
            className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Return to Menu
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 pb-28 sm:px-6 sm:py-12">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href={`/menu/${menuId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Digital Menu
        </Link>
        <button
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:text-white"
        >
          <Edit3 className="h-3.5 w-3.5" /> Correct Dish Details
        </button>
      </div>

      {/* SECTION 1: BASIC INFORMATION */}
      <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {dish.category && (
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                {dish.category}
              </span>
            )}
            <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-300">
              Verbatim Menu Record
            </span>
          </div>
          <span className="font-mono text-2xl font-bold text-emerald-400">
            {dish.price !== null && dish.price !== undefined
              ? `${dish.currency || "$"}${Number(dish.price).toFixed(2)}`
              : <span className="text-sm font-normal text-zinc-500">Price unlisted on menu</span>}
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {dish.name}
        </h1>

        <div className="mt-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Original Restaurant Description
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-200">
            {dish.description || dish.source_text || "No descriptive text printed on the menu."}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
          <span>Source: {dish.source_page || "Uploaded menu file"}</span>
          <span>•</span>
          <span>
            OCR Confidence: {Math.round((dish.extraction_confidence || 0.8) * 100)}%
          </span>
          {dish.is_user_corrected && (
            <>
              <span>•</span>
              <span className="text-blue-400">User Verified</span>
            </>
          )}
        </div>
      </section>

      {!!explanation?.images?.length && (
        <section className="mt-8">
          <h2 className="text-base font-bold text-white">Dish reference photos</h2>
          <p className="mt-1 text-xs text-zinc-400">Images from the web; restaurant presentation may vary.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {explanation.images.map((image) => (
              <figure key={image.url} className="overflow-hidden rounded-2xl border border-zinc-800">
                <img src={image.url} alt={image.title || dish.name} loading="lazy"
                  referrerPolicy="no-referrer" className="h-48 w-full object-cover"
                  onError={(event) => { event.currentTarget.style.display = "none"; }} />
                <figcaption className="p-3 text-xs text-zinc-400">
                  <a href={image.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline">Wikimedia Commons · {image.license}</a>
                  {image.artist && <p className="mt-1">Photo: {image.artist}</p>}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 2: UNDERSTAND THIS DISH (AI EXPLANATION) */}
      <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
            <Sparkles className="h-4 w-4" />
            <span>Understand This Dish</span>
          </div>
          <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[10px] text-zinc-400">
            General Culinary Context
          </span>
        </div>

        {explaining ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            Generating grounded culinary explanation...
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {/* Plain English explanation */}
            <div>
              <p className="text-base leading-relaxed text-zinc-200">
                {explanation?.general_explanation ||
                  `A traditional ${dish.category || "specialty"} prepared with authentic ingredients. Ask your server for pairing suggestions.`}
              </p>
            </div>

            {/* Flavor profile & Spice level */}
            {(explanation?.flavor_profile || explanation?.spice_level) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {explanation.flavor_profile && (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Flavour Profile
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">{explanation.flavor_profile}</p>
                  </div>
                )}
                {explanation.spice_level && (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Estimated Spice Level
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">{explanation.spice_level}</p>
                  </div>
                )}
              </div>
            )}

            {/* Unfamiliar culinary terms dictionary */}
            {explanation?.culinary_terms && Object.keys(explanation.culinary_terms).length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Culinary Terms in This Dish
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {Object.entries(explanation.culinary_terms).map(([term, def]) => (
                    <div
                      key={term}
                      className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4"
                    >
                      <h4 className="text-sm font-bold text-blue-300">{term}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-300">{def}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fact distinction badge */}
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs text-zinc-400">
              <Info className="h-4 w-4 shrink-0 text-blue-400" />
              <span>
                Restaurant descriptions are taken verbatim from the menu. Explanations and culinary terms are provided for educational context.
              </span>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 3: INGREDIENTS AND DIETARY INFORMATION */}
      <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <BookOpen className="h-4 w-4 text-emerald-400" />
          <span>Ingredients & Dietary Safety</span>
        </div>

        {/* Allergy Warning Box (Critical Requirement) */}
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-200">
              Dietary & Allergy Advisory
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100">
              {explanation?.allergy_warning ||
                "Menu text alone cannot establish that a dish is safe for someone with an allergy. Always verify severe allergies, cross-contamination risks, and exact preparation directly with restaurant staff."}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {/* Explicitly Listed Ingredients */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Ingredients Stated on Menu
            </h3>
            {dish.ingredients && dish.ingredients.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {dish.ingredients.map((ing) => (
                  <li
                    key={ing}
                    className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white"
                  >
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{ing}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs italic text-zinc-500">
                No specific ingredients explicitly detailed on the printed menu.
              </p>
            )}
          </div>

          {/* Inferred Ingredients (Clearly Labeled as Unverified) */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Inferred Culinary Foundation{" "}
              <span className="text-[10px] font-normal text-amber-400">(Unverified)</span>
            </h3>
            {explanation?.inferred_ingredients && explanation.inferred_ingredients.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {explanation.inferred_ingredients.map((inf, i) => (
                  <li
                    key={i}
                    className="flex flex-col rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-300">{inf.name}</span>
                      <span className="text-[10px] text-amber-400">Unverified</span>
                    </div>
                    {inf.note && <p className="mt-0.5 text-[11px] text-zinc-500">{inf.note}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs italic text-zinc-500">
                Standard culinary elements not estimated.
              </p>
            )}
          </div>
        </div>

        {/* Dietary labels & Allergen Disclosures */}
        <div className="mt-6 border-t border-zinc-800/80 pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Dietary Labels Stated
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dish.dietary_labels && dish.dietary_labels.length > 0 ? (
                  dish.dietary_labels.map((lbl) => (
                    <span
                      key={lbl}
                      className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300"
                    >
                      {lbl}
                    </span>
                  ))
                ) : (
                  <span className="text-xs italic text-zinc-500">
                    No dietary labels explicitly claimed on menu.
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Allergens Disclosed
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dish.allergens && dish.allergens.length > 0 ? (
                  dish.allergens.map((alg) => (
                    <span
                      key={alg}
                      className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300"
                    >
                      <ShieldAlert className="h-3 w-3" />
                      {alg}
                    </span>
                  ))
                ) : (
                  <span className="text-xs italic text-zinc-500">
                    No allergens explicitly documented on menu.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: EXPLORE ALTERNATIVES FROM THIS MENU */}
      {explanation?.alternatives && explanation.alternatives.length > 0 && (
        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Explore Menu Alternatives</h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Other relevant options from this same restaurant menu
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {explanation.alternatives.map((alt) => (
              <div
                key={alt.dish_id}
                onClick={() => router.push(`/menu/${menuId}/dish/${alt.dish_id}`)}
                className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-blue-300">
                    {alt.name}
                  </h4>
                  {alt.price !== null && alt.price !== undefined && (
                    <span className="mt-1 block font-mono text-xs font-semibold text-emerald-400">
                      {alt.currency || "$"}{Number(alt.price).toFixed(2)}
                    </span>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                    {alt.similarity_reason}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-blue-400">
                  <span>View dish</span>
                  <ChevronRight className="h-3 w-3 group-hover:translate-x-1 transition" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Edit Dish Modal */}
      {editOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Correct Dish Information</h3>
                <p className="text-xs text-zinc-400">Update verified menu details</p>
              </div>
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-300">Dish Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-300">Price (numeric)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-300">Currency Symbol</label>
                  <input
                    type="text"
                    value={editForm.currency}
                    onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-300">Category</label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-300">Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-300">
                  Dietary Labels (comma-separated)
                </label>
                <input
                  type="text"
                  value={editForm.dietaryLabels}
                  onChange={(e) => setEditForm({ ...editForm, dietaryLabels: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
