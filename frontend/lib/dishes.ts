import type { ApiDish, ApiTasteBridge } from "@/lib/api";

export type Dish = {
  id: string;
  name: string;
  phonetic: string;
  literal: string;
  analogy: string;
  technique: string;
  mouthfeel: string;
  familiarity: number;
  heat: number;
  richness: number;
  salt: number;
  umami: number;
  safe: boolean;
  warning?: string;
  waiterText: string;
  waiterTranslation: string;
  photo: string;
  story?: string;
  confidence?: number;
};

export const SCAN_DISH_STORAGE_KEY = "prebite:scan-dishes";

export function isScannedDishId(id?: string | null): boolean {
  return typeof id === "string" && /^extracted-/i.test(id);
}

export function saveScannedDishes(dishes: Dish[]) {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(SCAN_DISH_STORAGE_KEY, JSON.stringify(dishes));
}

export function readScannedDish(id: string): Dish | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(SCAN_DISH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const items = JSON.parse(raw) as Dish[];
    return items.find((dish) => dish.id === id) ?? null;
  } catch {
    return null;
  }
}

export function fromApiDish(source: ApiDish, bridge?: ApiTasteBridge): Dish {
  const flags = bridge?.dietary_flags ?? source.dietary_flags;
  const containsPork = flags.some((flag) => /pork|guanciale/i.test(flag));
  const phrase = source.order_phrases?.[0];

  return {
    id: source.id,
    name: source.name,
    phonetic: source.name,
    literal: source.description,
    analogy: bridge?.explanation ?? source.familiarity_bridge,
    technique: source.description,
    mouthfeel: source.new_tags.join(" · ") || "Ask your server about the texture.",
    familiarity: bridge?.familiarity_score ?? source.familiarity_score,
    heat: source.new_tags.some((tag) => /chilli|pepper|spicy/i.test(tag)) ? 3 : 1,
    richness: source.ingredients.some((item) => /cheese|egg|pork|cream/i.test(item)) ? 4 : 2,
    salt: source.ingredients.some((item) => /capers|anchovy|cheese|cured/i.test(item)) ? 4 : 2,
    umami: source.ingredients.some((item) => /anchovy|cheese|pork/i.test(item)) ? 4 : 2,
    safe: !containsPork,
    warning: containsPork ? "Contains Pork" : undefined,
    waiterText: phrase?.text ?? "Posso avere questo piatto, per favore?",
    waiterTranslation: phrase?.meaning ?? "May I have this dish, please?",
    photo: source.image_url ?? source.photo ?? "",
    story: source.dish_story ?? source.gemini_summary ?? source.description,
    confidence: source.gemini_confidence ?? 0.82,
  };
}

export const dishes: Dish[] = [
  {
    id: "spaghetti-aglio-e-olio",
    name: "Spaghetti Aglio e Olio",
    phonetic: "Ah-lyo eh Oh-lyo",
    literal: "Spaghetti with garlic and oil",
    analogy: "Garlic & Chilli Tadka",
    technique: "Garlic blooms slowly in olive oil, then pasta water binds it into a light gloss — the same fragrant bloom-and-toss energy as a chilli tadka.",
    mouthfeel: "Glossy, al dente chew, no heavy cream.",
    familiarity: 85,
    heat: 3,
    richness: 2,
    salt: 2,
    umami: 2,
    safe: true,
    waiterText: "Poco piccante, per favore.",
    waiterTranslation: "A little spicy, please.",
    photo: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=85",
    story: "A silky olive oil finish with fragrant garlic and a gentle chilli snap.",
    confidence: 0.9,
  },
  {
    id: "rigatoni-carbonara",
    name: "Rigatoni alla Carbonara",
    phonetic: "Ree-gah-TOH-nee ahl-lah car-boh-NAH-rah",
    literal: "Rigatoni in the charcoal-burner style",
    analogy: "Tempered Egg & Pepper Gravy",
    technique: "Hot pasta tempers egg yolk and pecorino into a silky emulsion. No cream: the richness comes from egg, cheese, and rendered guanciale.",
    mouthfeel: "Velvety, dense sauce in ridged tubes with crisp pork pieces.",
    familiarity: 35,
    heat: 1,
    richness: 5,
    salt: 4,
    umami: 5,
    safe: false,
    warning: "Contains Guanciale / Pork",
    waiterText: "È possibile farlo senza carne di maiale, per favore?",
    waiterTranslation: "Is it possible to make it without pork, please?",
    photo: "https://images.unsplash.com/photo-1556761223-4c4282c73f77?auto=format&fit=crop&w=1200&q=85",
    story: "Silky, rich, and deeply savoury; best for diners who love powerful umami.",
    confidence: 0.88,
  },
  {
    id: "cacio-e-pepe",
    name: "Tonnarelli Cacio e Pepe",
    phonetic: "KAH-cho eh PEH-peh",
    literal: "Pasta with cheese and pepper",
    analogy: "Peppery Cheese Dry Coat",
    technique: "Sharp pecorino and starchy water emulsify into a clinging coat, while black pepper gives it a dry-masala-like aromatic bite.",
    mouthfeel: "Springy, square-cut pasta with a clingy, pepper-speckled cheese coat.",
    familiarity: 70,
    heat: 3,
    richness: 4,
    salt: 4,
    umami: 4,
    safe: true,
    waiterText: "Un piatto di Cacio e Pepe, per favore.",
    waiterTranslation: "One plate of Cacio e Pepe, please.",
    photo: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=85",
    story: "Comforting and intense without being heavy — a peppery, creamy classic.",
    confidence: 0.92,
  },
];

export function getDish(id: string) { return dishes.find((dish) => dish.id === id); }
