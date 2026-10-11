export type Dish = {
  id: "spaghetti-aglio-e-olio" | "rigatoni-carbonara" | "cacio-e-pepe";
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
};

export const dishes: Dish[] = [
  { id: "spaghetti-aglio-e-olio", name: "Spaghetti Aglio e Olio", phonetic: "Ah-lyo eh Oh-lyo", literal: "Spaghetti with garlic and oil", analogy: "Garlic & Chilli Tadka", technique: "Garlic blooms slowly in olive oil, then pasta water binds it into a light gloss — the same fragrant bloom-and-toss energy as a chilli tadka.", mouthfeel: "Glossy, al dente chew, no heavy cream.", familiarity: 85, heat: 3, richness: 2, salt: 2, umami: 2, safe: true, waiterText: "Poco piccante, per favore.", waiterTranslation: "A little spicy, please.", photo: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=85" },
  { id: "rigatoni-carbonara", name: "Rigatoni alla Carbonara", phonetic: "Ree-gah-TOH-nee ahl-lah car-boh-NAH-rah", literal: "Rigatoni in the charcoal-burner style", analogy: "Tempered Egg & Pepper Gravy", technique: "Hot pasta tempers egg yolk and pecorino into a silky emulsion. No cream: the richness comes from egg, cheese, and rendered guanciale.", mouthfeel: "Velvety, dense sauce in ridged tubes with crisp pork pieces.", familiarity: 35, heat: 1, richness: 5, salt: 4, umami: 5, safe: false, warning: "Contains Guanciale / Pork", waiterText: "È possibile farlo senza carne di maiale, per favore?", waiterTranslation: "Is it possible to make it without pork, please?", photo: "https://images.unsplash.com/photo-1556761223-4c4282c73f77?auto=format&fit=crop&w=1200&q=85" },
  { id: "cacio-e-pepe", name: "Tonnarelli Cacio e Pepe", phonetic: "KAH-cho eh PEH-peh", literal: "Pasta with cheese and pepper", analogy: "Peppery Cheese Dry Coat", technique: "Sharp pecorino and starchy water emulsify into a clinging coat, while black pepper gives it a dry-masala-like aromatic bite.", mouthfeel: "Springy, square-cut pasta with a clingy, pepper-speckled cheese coat.", familiarity: 70, heat: 3, richness: 4, salt: 4, umami: 4, safe: true, waiterText: "Un piatto di Cacio e Pepe, per favore.", waiterTranslation: "One plate of Cacio e Pepe, please.", photo: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=85" },
];

export function getDish(id: string) { return dishes.find((dish) => dish.id === id); }
