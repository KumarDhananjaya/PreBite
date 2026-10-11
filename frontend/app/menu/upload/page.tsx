"use client";

import { ChangeEvent, DragEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
  UtensilsCrossed,
} from "lucide-react";
import { api, type ApiMenuSummary } from "@/lib/api";

type SelectedFile = {
  id: string;
  file: File;
  previewUrl: string | null;
  name: string;
  sizeFormatted: string;
  isPdf: boolean;
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export default function MenuUploadPage() {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [restaurantName, setRestaurantName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>("");
  const [recentMenus, setRecentMenus] = useState<ApiMenuSummary[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Fetch recent menus on mount
  useEffect(() => {
    api
      .listMenus()
      .then((res) => setRecentMenus(res.items || []))
      .catch(() => setRecentMenus([]))
      .finally(() => setLoadingRecent(false));
  }, []);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateAndAddFiles = (incoming: FileList | File[]) => {
    setValidationError(null);
    const newItems: SelectedFile[] = [];

    for (let i = 0; i < incoming.length; i++) {
      const file = incoming[i];
      const lowerName = file.name.toLowerCase();

      // Check empty
      if (file.size === 0) {
        setValidationError(`"${file.name}" is an empty file (0 bytes). Please upload a valid menu document.`);
        return;
      }

      // Check size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setValidationError(`"${file.name}" exceeds the 20MB limit (${formatSize(file.size)}).`);
        return;
      }

      // Check format
      const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
      const hasValidType = ALLOWED_TYPES.includes(file.type);
      if (!hasValidExt && !hasValidType) {
        setValidationError(
          `"${file.name}" has an unsupported format. Supported formats: JPEG, PNG, WebP, or PDF.`
        );
        return;
      }

      const isPdf = lowerName.endsWith(".pdf") || file.type === "application/pdf";
      const previewUrl = isPdf ? null : URL.createObjectURL(file);

      newItems.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl,
        name: file.name,
        sizeFormatted: formatSize(file.size),
        isPdf,
      });
    }

    setSelectedFiles((prev) => [...prev, ...newItems]);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
    }
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (id: string) => {
    setSelectedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setValidationError("Please select at least one menu file (image or PDF) before submitting.");
      return;
    }

    setValidationError(null);
    setIsUploading(true);

    try {
      setUploadStep("Uploading menu pages to server...");
      const filesToSend = selectedFiles.map((sf) => sf.file);

      // Simulate step transitions for smooth user feedback
      setTimeout(() => {
        setUploadStep("Running OCR & Vision extraction...");
      }, 700);

      setTimeout(() => {
        setUploadStep("Detecting dishes, prices & dietary flags...");
      }, 1500);

      const menu = await api.uploadMenu(filesToSend, restaurantName.trim() || undefined);

      // Save active menu ID to localStorage for fast session restoration
      try {
        localStorage.setItem("prebite_active_menu_id", menu.id);
      } catch {
        // ignore storage errors
      }

      setUploadStep("Extraction complete! Opening digital menu...");
      router.push(`/menu/${menu.id}`);
    } catch (err) {
      setIsUploading(false);
      setUploadStep("");
      const message = err instanceof Error ? err.message : "Failed to process menu upload. Please try again.";
      setValidationError(message);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
          <UtensilsCrossed className="h-4 w-4" />
          <span>Menu Ingestion</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Upload Restaurant Menu</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
          Upload single or multi-page menus in JPG, PNG, WebP, or PDF format. PreBite extracts dishes,
          preserves verbatim descriptions, detects dietary cues, and builds an interactive digital menu.
        </p>
      </div>

      {/* Error alert banner */}
      {validationError && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="font-medium text-red-100">Upload Issue</p>
            <p className="mt-1 text-xs text-red-300">{validationError}</p>
          </div>
          <button
            onClick={() => setValidationError(null)}
            className="text-xs text-red-400 hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Upload Box */}
      <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
        {/* Optional Restaurant Name */}
        <div className="mb-6">
          <label htmlFor="restaurant-name" className="block text-xs font-medium uppercase tracking-wider text-zinc-400">
            Restaurant or Menu Name (Optional)
          </label>
          <input
            id="restaurant-name"
            type="text"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            disabled={isUploading}
            placeholder="e.g. Trattoria da Enzo, Roman Lunch Menu"
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-blue-500"
          />
        </div>

        {/* Drag and Drop Zone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
            isDragging
              ? "border-blue-500 bg-blue-500/10"
              : "border-zinc-700 bg-zinc-950/60 hover:border-zinc-500 hover:bg-zinc-900/60"
          } ${isUploading ? "pointer-events-none opacity-50" : ""}`}
        >
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileInput}
            disabled={isUploading}
            className="sr-only"
          />
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-800 text-blue-400 shadow-inner">
            <UploadCloud className="h-6 w-6" />
          </div>
          <span className="mt-4 text-base font-semibold text-white">
            Choose menu files or drag & drop here
          </span>
          <span className="mt-1 text-xs text-zinc-400">
            JPG, PNG, WebP, or multi-page PDF · Up to 20MB per file
          </span>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300">
            <Plus className="h-3.5 w-3.5 text-blue-400" /> Select multiple pages
          </span>
        </label>

        {/* Selected Files Preview List */}
        {selectedFiles.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wider text-zinc-300">
                Selected Pages ({selectedFiles.length})
              </span>
              <span>Review before processing</span>
            </div>

            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {selectedFiles.map((item, index) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3"
                >
                  {/* Thumbnail / Icon */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                    {item.isPdf ? (
                      <div className="flex h-full w-full flex-col items-center justify-center text-red-400">
                        <FileText className="h-6 w-6" />
                        <span className="text-[9px] font-bold">PDF</span>
                      </div>
                    ) : item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-500">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                        Page {index + 1}
                      </span>
                      <p className="truncate text-xs font-medium text-white">{item.name}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">{item.sizeFormatted}</p>
                  </div>

                  {/* Remove action */}
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      aria-label={`Remove ${item.name}`}
                      className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Upload Processing State / Button */}
        <div className="mt-8 border-t border-zinc-800/80 pt-6">
          {isUploading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              <p className="mt-3 text-sm font-semibold text-white">{uploadStep}</p>
              <p className="mt-1 text-xs text-zinc-400">
                Please keep this page open while we structure your digital menu.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="text-xs text-zinc-500">
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} file(s) ready to extract.`
                  : "Select one or more files to start."}
              </p>
              <button
                type="button"
                onClick={handleUpload}
                disabled={selectedFiles.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                Start Menu Processing
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Previously Processed Menus */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-white">Previously Processed Menus</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Revisit any previously uploaded menu without needing to re-upload.
        </p>

        {loadingRecent ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            Loading uploaded menus...
          </div>
        ) : recentMenus.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 text-center text-xs text-zinc-500">
            No menus uploaded yet. Upload your first menu above!
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {recentMenus.map((m) => (
              <Link
                key={m.id}
                href={`/menu/${m.id}`}
                className="group flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white group-hover:text-blue-300">
                      {m.restaurant_name || m.menu_name || "Restaurant Menu"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      {m.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    {m.dish_count} dishes · {m.source_files_count || 1} file(s)
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-600 transition group-hover:translate-x-1 group-hover:text-blue-400" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
