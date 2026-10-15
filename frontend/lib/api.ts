const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001/api/v1";

export type ApiUser = { id: string; name: string; email: string; home_cuisine?: string | null };
export type AuthResponse = { access_token: string; token_type: "bearer"; user: ApiUser };

export type ApiDish = {
  id: string;
  name: string;
  cuisine: string;
  description: string;
  ingredients: string[];
  familiarity_score: number;
  new_tags: string[];
  dietary_flags: string[];
  familiarity_bridge: string;
  order_phrases?: { text: string; meaning: string; language: string }[];
  taste_bridges?: Record<string, string>;
  image_url?: string;
  photo?: string;
  gemini_summary?: string;
  dish_story?: string;
  best_ordering?: string;
  dietary_notes?: string[] | string;
  gemini_confidence?: number;
};

export type ScanMenuItem = ApiDish & {
  summary?: string;
  explanation?: string;
  photo?: string;
  confidence?: number;
};

export type ApiScanMenuResponse = {
  items: ScanMenuItem[];
  filename: string;
  count: number;
};

export type ApiMenuDish = {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  category?: string | null;
  ingredients?: string[];
  dietary_labels?: string[];
  allergens?: string[];
  source_text?: string | null;
  source_page?: string | null;
  extraction_confidence?: number;
  confidence_flag?: boolean;
  menu_id?: string;
  status?: string;
  menu_source?: string;
  is_user_corrected?: boolean;
  image_url?: string | null;
  image_source_url?: string | null;
  image_source?: string | null;
  image_provider?: string | null;
  photo?: string | null;
};

export type ApiMenu = {
  id: string;
  restaurant_name?: string | null;
  menu_name?: string | null;
  status: string;
  source_files?: Array<{ name: string; content_type?: string; size?: number; page_index?: number }>;
  dishes: ApiMenuDish[];
  created_at?: string;
  updated_at?: string;
};

export type ApiMenuSummary = {
  id: string;
  restaurant_name?: string | null;
  menu_name?: string | null;
  status: string;
  dish_count: number;
  source_files_count: number;
  created_at?: string;
  updated_at?: string;
};

export type DishAlternative = {
  dish_id: string;
  name: string;
  price?: number | null;
  currency?: string | null;
  category?: string | null;
  dietary_labels: string[];
  similarity_reason: string;
};

export type InferredIngredient = {
  name: string;
  verified: boolean;
  note?: string | null;
};

export type CuisineComparison = {
  home_cuisine: string;
  comparison: { familiar_dish: string; summary: string; rows: { aspect: string; dish: string; home: string; difference: string }[] } | null;
};

export type DishExplanation = {
  images?: { url: string; source_url: string; title: string; artist: string; license: string; source?: string; provider?: string }[];
  dish_id: string;
  dish_name: string;
  menu_category?: string | null;
  menu_price?: number | null;
  menu_currency?: string | null;
  source_description?: string | null;
  source_menu?: string | null;
  source_page?: string | null;
  general_explanation: string;
  culinary_terms: Record<string, string>;
  flavor_profile?: string | null;
  spice_level?: string | null;
  restaurant_facts: Record<string, unknown>;
  ai_inferences: Record<string, unknown>;
  explicit_ingredients: string[];
  inferred_ingredients: InferredIngredient[];
  dietary_labels: string[];
  explicit_allergens: string[];
  allergy_warning: string;
  alternatives: DishAlternative[];
  uncertain_fields: string[];
  confidence: number;
  cached?: boolean;
};

export type ScanMatchItem = ApiMenuDish & {
  scan_confidence: number;
  match_reason?: string | null;
  matched_text?: string | null;
};

export type ApiTasteBridge = {
  dish_id: string;
  dish_name: string;
  explanation: string;
  familiarity_score: number;
  dietary_flags: string[];
  new_tags: string[];
  image_url?: string;
  dish_story?: string;
};

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) => request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) => request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  me: (token: string) => request<ApiUser>("/auth/me", {}, token),
  updateProfile: (token: string, values: { name?: string; home_cuisine?: string }) => request<ApiUser>("/users/me", { method: "PATCH", body: JSON.stringify(values) }, token),
  listDishes: (cuisine?: string) => request<{ items: ApiDish[] }>(cuisine ? `/dishes?cuisine=${encodeURIComponent(cuisine)}` : "/dishes"),
  dish: (id: string) => request<ApiDish>(`/dishes/${encodeURIComponent(id)}`),
  scanMenu: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/dishes/scan-menu`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(body?.detail ?? "Unable to scan the uploaded menu.");
    }

    return response.json() as Promise<ApiScanMenuResponse>;
  },
  listMenus: () => request<{ items: ApiMenuSummary[] }>("/menus"),
  uploadMenu: async (fileOrFiles: File | File[], restaurantName?: string) => {
    const formData = new FormData();
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];

    for (const f of files) {
      formData.append("files", f);
    }
    // Also include single file key for backward compatibility
    if (files.length === 1) {
      formData.append("file", files[0]);
    }
    if (restaurantName) {
      formData.append("restaurant_name", restaurantName);
    }

    const response = await fetch(`${API_BASE_URL}/menus/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(body?.detail ?? "Unable to upload the menu.");
    }

    return response.json() as Promise<ApiMenu>;
  },
  getMenu: (menuId: string) => request<ApiMenu>(`/menus/${encodeURIComponent(menuId)}`),
  listMenuDishes: (menuId: string, params?: { q?: string; category?: string; dietary?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set("q", params.q);
    if (params?.category) searchParams.set("category", params.category);
    if (params?.dietary) searchParams.set("dietary", params.dietary);
    const qs = searchParams.toString();
    return request<{ items: ApiMenuDish[] }>(`/menus/${encodeURIComponent(menuId)}/dishes${qs ? `?${qs}` : ""}`);
  },
  getMenuDish: (menuId: string, dishId: string) => request<ApiMenuDish>(`/menus/${encodeURIComponent(menuId)}/dishes/${encodeURIComponent(dishId)}`),
  patchMenuDish: (menuId: string, dishId: string, values: Partial<ApiMenuDish>) =>
    request<ApiMenuDish>(`/menus/${encodeURIComponent(menuId)}/dishes/${encodeURIComponent(dishId)}`, {
      method: "PATCH",
      body: JSON.stringify(values),
    }),
  scanMenuImage: async (menuId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_URL}/menus/${encodeURIComponent(menuId)}/scan`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(body?.detail ?? "Unable to scan the uploaded dish image.");
    }
    return response.json() as Promise<{ items: ScanMatchItem[] }>;
  },
  compareMenuDish: (menuId: string, dishId: string, cuisine: string) =>
    request<CuisineComparison>(`/menus/${encodeURIComponent(menuId)}/dishes/${encodeURIComponent(dishId)}/comparison?home_cuisine=${encodeURIComponent(cuisine)}`, { method: "POST" }),
  explainMenuDish: (menuId: string, dishId: string) =>
    request<DishExplanation>(`/menus/${encodeURIComponent(menuId)}/dishes/${encodeURIComponent(dishId)}/explain`, { method: "POST" }),
  retryMenu: async (menuId: string, file?: File) => {
    const formData = new FormData();
    if (file) {
      formData.append("file", file);
    }
    const response = await fetch(`${API_BASE_URL}/menus/${encodeURIComponent(menuId)}/retry`, {
      method: "POST",
      body: file ? formData : undefined,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(body?.detail ?? "Unable to retry menu processing.");
    }
    return response.json() as Promise<ApiMenu>;
  },
  dishInsight: (id: string) =>
    request<{ dish_id: string; dish_name: string; summary?: string; why_it_works?: string; best_ordering?: string; dietary_notes?: string[] | string; confidence?: number; image_url?: string }>(
      `/dishes/${encodeURIComponent(id)}/insight`
    ),
  tasteBridge: (id: string, homeCuisine: string) =>
    request<ApiTasteBridge>(`/dishes/${encodeURIComponent(id)}/taste-bridge?home_cuisine=${encodeURIComponent(homeCuisine)}`),
};
