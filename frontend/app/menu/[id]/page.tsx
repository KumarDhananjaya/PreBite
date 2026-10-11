"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Edit3,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  api,
  type ApiMenu,
  type ApiMenuDish,
  type ScanMatchItem,
} from "@/lib/api";

export default function DigitalMenuPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const menuId = params.id;

  const [menu, setMenu] = useState<ApiMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDietary, setSelectedDietary] = useState("all");

  // Edit Dish Modal State
  const [editingDish, setEditingDish] = useState<ApiMenuDish | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    price: string;
    currency: string;
    category: string;
    dietaryLabels: string;
  }>({
    name: "",
    description: "",
    price: "",
    currency: "$",
    category: "",
    dietaryLabels: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Scan Printed Menu Modal State
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanningImage, setScanningImage] = useState(false);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [scanMatches, setScanMatches] = useState<ScanMatchItem[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const loadMenu = async () => {
    try {
      setLoading(true);
      setErrorNotice(null);
      const data = await api.getMenu(menuId);
      setMenu(data);
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : "Failed to load menu details.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (menuId) {
      loadMenu();
    }
  }, [menuId]);

  // Derive unique categories
  const categories = useMemo(() => {
    if (!menu?.dishes) return ["all"];
    const cats = new Set<string>();
    menu.dishes.forEach((d) => {
      if (d.category && d.category.trim()) {
        cats.add(d.category.trim());
      }
    });
    return ["all", ...Array.from(cats)];
  }, [menu]);

  // Derive unique dietary labels
  const allDietaryLabels = useMemo(() => {
    if (!menu?.dishes) return [];
    const labels = new Set<string>();
    menu.dishes.forEach((d) => {
      d.dietary_labels?.forEach((lbl) => {
        if (lbl && lbl.trim()) labels.add(lbl.trim());
      });
    });
    return Array.from(labels);
  }, [menu]);

  // Filter dishes client-side for ultra-fast, snappy UI
  const filteredDishes = useMemo(() => {
    if (!menu?.dishes) return [];
    const query = searchQuery.trim().toLowerCase();

    return menu.dishes.filter((dish) => {
      // Category filter
      if (
        selectedCategory !== "all" &&
        (dish.category || "").toLowerCase() !== selectedCategory.toLowerCase()
      ) {
        return false;
      }
      // Dietary filter
      if (selectedDietary !== "all") {
        const hasTag = dish.dietary_labels?.some(
          (lbl) => lbl.toLowerCase() === selectedDietary.toLowerCase(),
        );
        if (!hasTag) return false;
      }
      // Search query
      if (query) {
        const inName = (dish.name || "").toLowerCase().includes(query);
        const inDesc = (dish.description || "").toLowerCase().includes(query);
        const inIng =
          dish.ingredients?.some((ing) => ing.toLowerCase().includes(query)) ||
          false;
        if (!inName && !inDesc && !inIng) return false;
      }
      return true;
    });
  }, [menu, searchQuery, selectedCategory, selectedDietary]);

  // Handle Retry
  const handleRetry = async () => {
    try {
      setRetrying(true);
      setErrorNotice(null);
      const fresh = await api.retryMenu(menuId);
      setMenu(fresh);
    } catch (err) {
      setErrorNotice(
        err instanceof Error
          ? err.message
          : "Retry failed. You can re-upload the menu.",
      );
    } finally {
      setRetrying(false);
    }
  };

  // Open Edit Dish Modal
  const openEditModal = (dish: ApiMenuDish, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDish(dish);
    setEditForm({
      name: dish.name || "",
      description: dish.description || "",
      price:
        dish.price !== null && dish.price !== undefined
          ? String(dish.price)
          : "",
      currency: dish.currency || "$",
      category: dish.category || "",
      dietaryLabels: (dish.dietary_labels || []).join(", "),
    });
  };

  // Save Dish Correction
  const handleSaveEdit = async () => {
    if (!editingDish) return;
    try {
      setSavingEdit(true);
      const numericPrice = editForm.price.trim()
        ? parseFloat(editForm.price)
        : null;
      const parsedDietary = editForm.dietaryLabels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const updated = await api.patchMenuDish(menuId, editingDish.id, {
        name: editForm.name.trim() || editingDish.name,
        description: editForm.description.trim() || null,
        price: numericPrice,
        currency: editForm.currency.trim() || "$",
        category: editForm.category.trim() || null,
        dietary_labels: parsedDietary,
      });

      // Update state locally
      setMenu((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          dishes: prev.dishes.map((d) =>
            d.id === updated.id ? { ...d, ...updated } : d,
          ),
        };
      });

      setEditingDish(null);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to save dish corrections.",
      );
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Scan Crop / Photo of Printed Menu
  const handleScanFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setScanPreviewUrl(preview);
    setScanningImage(true);
    setScanError(null);
    setScanMatches(null);

    try {
      const res = await api.scanMenuImage(menuId, file);
      setScanMatches(res.items || []);
    } catch (err) {
      setScanError(
        err instanceof Error
          ? err.message
          : "Failed to scan printed menu image.",
      );
    } finally {
      setScanningImage(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
        <h2 className="mt-4 text-lg font-semibold text-white">
          Loading Digital Menu...
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          Fetching extracted dishes and dietary cues.
        </p>
      </main>
    );
  }

  if (errorNotice && !menu) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
          <h1 className="mt-4 text-xl font-bold text-white">
            Unable to Load Menu
          </h1>
          <p className="mt-2 text-sm text-zinc-400">{errorNotice}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={loadMenu}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </button>
            <Link
              href="/menu/upload"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white"
            >
              Upload New Menu
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Top Breadcrumb & Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <Link
            href="/menu/upload"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Upload another menu
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {menu?.restaurant_name || menu?.menu_name || "Restaurant Menu"}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              <Check className="h-3.5 w-3.5" />
              {menu?.status === "processed" ? "Processed" : menu?.status}
            </span>
            {menu?.source_files && menu.source_files.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-400">
                <FileText className="h-3 w-3 text-blue-400" />
                {menu.source_files.length}{" "}
                {menu.source_files.length === 1 ? "page" : "pages"}
              </span>
            )}
          </div>
        </div>

        {/* Scan printed snippet button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setScanModalOpen(true);
              setScanMatches(null);
              setScanPreviewUrl(null);
              setScanError(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/10 px-4 py-2.5 text-xs font-semibold text-blue-300 transition hover:bg-blue-600/20 active:scale-[0.98]"
          >
            <ScanLine className="h-4 w-4 text-blue-400" />
            Scan Printed Dish
          </button>
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            title="Reprocess menu extraction"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${retrying ? "animate-spin text-blue-400" : ""}`}
            />
            {retrying ? "Retrying…" : "Reprocess"}
          </button>
        </div>
      </div>

      {/* Global alert if error occurs */}
      {errorNotice && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          <span>{errorNotice}</span>
          <button
            onClick={() => setErrorNotice(null)}
            className="text-amber-400 hover:text-amber-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Filter Bar */}
      <section className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, ingredients, or descriptions..."
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Dietary Filter Dropdown */}
          {allDietaryLabels.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <Filter className="h-3.5 w-3.5 text-zinc-500" />
              <select
                value={selectedDietary}
                onChange={(e) => setSelectedDietary(e.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs font-medium text-zinc-300 outline-none focus:border-blue-500"
              >
                <option value="all">All Dietary Labels</option>
                {allDietaryLabels.map((lbl) => (
                  <option key={lbl} value={lbl}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Category Tabs */}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold capitalize transition ${
                  selectedCategory.toLowerCase() === cat.toLowerCase()
                    ? "bg-white text-zinc-950"
                    : "border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {cat === "all"
                  ? `All Categories (${menu?.dishes.length || 0})`
                  : cat}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Dish Count Header */}
      <div className="mt-6 flex items-center justify-between text-xs text-zinc-500">
        <span>
          Showing {filteredDishes.length} of {menu?.dishes.length || 0}{" "}
          extracted dishes
        </span>
        {menu?.dishes.some((d) => d.confidence_flag) && (
          <span className="flex items-center gap-1 text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" /> Items with review badge have
            lower OCR confidence
          </span>
        )}
      </div>

      {/* Dishes Grid */}
      {filteredDishes.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <UtensilsCrossed className="mx-auto h-8 w-8 text-zinc-600" />
          <h2 className="mt-3 text-base font-semibold text-white">
            No matching dishes found
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Try adjusting your search query or category filters.
          </p>
          {(searchQuery ||
            selectedCategory !== "all" ||
            selectedDietary !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setSelectedDietary("all");
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:text-white"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDishes.map((dish) => {
            const imageUrl = dish.image_url || dish.photo;

            return (
              <article
                key={dish.id}
                onClick={() => router.push(`/menu/${menuId}/dish/${dish.id}`)}
                className="group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700 hover:bg-zinc-900/80 hover:shadow-xl"
              >
                <div>
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={dish.name}
                      className="mb-4 h-28 w-full rounded-xl border border-zinc-800 object-cover"
                    />
                  )}
                  {/* Header: Category + Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {dish.category && (
                        <span className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                          {dish.category}
                        </span>
                      )}
                      {dish.confidence_flag && (
                        <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          Needs review
                        </span>
                      )}
                      {dish.is_user_corrected && (
                        <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                          Edited
                        </span>
                      )}
                    </div>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={(e) => openEditModal(dish, e)}
                      aria-label={`Edit ${dish.name}`}
                      className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Dish Name & Price */}
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <h3 className="text-base font-bold text-white group-hover:text-blue-300">
                      {dish.name}
                    </h3>
                    <span className="shrink-0 font-mono text-sm font-semibold text-emerald-400">
                      {dish.price !== null && dish.price !== undefined ? (
                        `${dish.currency || "$"}${Number(dish.price).toFixed(2)}`
                      ) : (
                        <span className="text-xs text-zinc-500">Unlisted</span>
                      )}
                    </span>
                  </div>

                  {/* Original Description */}
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-400">
                    {dish.description ||
                      dish.source_text ||
                      "No description listed on menu."}
                  </p>

                  {/* Dietary and Allergen Tags */}
                  {((dish.dietary_labels && dish.dietary_labels.length > 0) ||
                    (dish.allergens && dish.allergens.length > 0)) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {dish.dietary_labels?.map((lbl) => (
                        <span
                          key={lbl}
                          className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
                        >
                          {lbl}
                        </span>
                      ))}
                      {dish.allergens?.map((alg) => (
                        <span
                          key={alg}
                          className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300"
                        >
                          <ShieldAlert className="h-2.5 w-2.5" />
                          {alg}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Card Footer */}
                <div className="mt-5 flex items-center justify-between border-t border-zinc-800/80 pt-3 text-xs">
                  <span className="text-[11px] text-zinc-500">
                    {dish.source_page || "Uploaded menu"}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-blue-400 group-hover:translate-x-0.5 transition">
                    Details
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Edit Dish Modal */}
      {editingDish && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Correct Dish Information
                </h3>
                <p className="text-xs text-zinc-400">
                  Update extracted menu data
                </p>
              </div>
              <button
                onClick={() => setEditingDish(null)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-300">
                  Dish Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-300">
                    Price (numeric)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.price}
                    onChange={(e) =>
                      setEditForm({ ...editForm, price: e.target.value })
                    }
                    placeholder="e.g. 18.50"
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-300">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={editForm.currency}
                    onChange={(e) =>
                      setEditForm({ ...editForm, currency: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-300">
                  Menu Category
                </label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) =>
                    setEditForm({ ...editForm, category: e.target.value })
                  }
                  placeholder="e.g. Primi, Pizza, Starters"
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-300">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
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
                  onChange={(e) =>
                    setEditForm({ ...editForm, dietaryLabels: e.target.value })
                  }
                  placeholder="e.g. Vegetarian, Gluten-Free"
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={() => setEditingDish(null)}
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
                {savingEdit ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save Corrections
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Printed Menu Snippet Modal (Option B) */}
      {scanModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Scan Printed Menu Dish
                </h3>
                <p className="text-xs text-zinc-400">
                  Point your camera or upload a crop of a dish name
                </p>
              </div>
              <button
                onClick={() => setScanModalOpen(false)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Upload / Camera input */}
            <label className="mt-6 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/40 p-5 text-center transition hover:border-blue-500 hover:bg-zinc-900">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleScanFile}
                className="sr-only"
              />
              {scanningImage ? (
                <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-800 text-blue-400">
                  <Camera className="h-5 w-5" />
                </div>
              )}
              <span className="mt-3 text-sm font-semibold text-white">
                {scanningImage
                  ? "Analyzing printed snippet..."
                  : "Take a photo or choose an image snippet"}
              </span>
              <span className="mt-1 text-xs text-zinc-500">
                Matches directly against this uploaded menu
              </span>
            </label>

            {/* Error notice */}
            {scanError && (
              <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                {scanError}
              </p>
            )}

            {/* Matches list */}
            {scanMatches !== null && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  <span>Match Results ({scanMatches.length})</span>
                </div>

                {scanMatches.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 text-center">
                    <p className="text-xs text-zinc-400">
                      No confident matches found on this menu for the scanned
                      snippet.
                    </p>
                    <p className="mt-2 text-xs text-blue-400">
                      Use the search bar on the digital menu to find it
                      manually.
                    </p>
                  </div>
                ) : (
                  <ul className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
                    {scanMatches.map((match) => (
                      <li
                        key={match.id}
                        onClick={() => {
                          setScanModalOpen(false);
                          router.push(`/menu/${menuId}/dish/${match.id}`);
                        }}
                        className="group flex cursor-pointer items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 transition hover:border-blue-500 hover:bg-blue-500/5"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white group-hover:text-blue-300">
                              {match.name}
                            </h4>
                            <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                              {Math.round(match.scan_confidence * 100)}% Match
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-400">
                            {match.match_reason}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-blue-400" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
