const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

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
};

export type ApiTasteBridge = {
  dish_id: string;
  explanation: string;
  familiarity_score: number;
  dietary_flags: string[];
  new_tags: string[];
};

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Something went wrong. Please try again.");
  }
  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) => request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) => request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  me: (token: string) => request<ApiUser>("/auth/me", {}, token),
  updateProfile: (token: string, values: { name?: string; home_cuisine?: string }) => request<ApiUser>("/users/me", { method: "PATCH", body: JSON.stringify(values) }, token),
  listDishes: (cuisine = "Italian") => request<{ items: ApiDish[] }>(`/dishes?cuisine=${encodeURIComponent(cuisine)}`),
  dish: (id: string) => request<ApiDish>(`/dishes/${encodeURIComponent(id)}`),
  tasteBridge: (id: string, homeCuisine: string) => request<ApiTasteBridge>(`/dishes/${encodeURIComponent(id)}/taste-bridge?home_cuisine=${encodeURIComponent(homeCuisine)}`),
};
