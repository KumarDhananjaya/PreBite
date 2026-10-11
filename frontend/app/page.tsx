import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Camera,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UtensilsCrossed,
} from "lucide-react";

const metrics = [
  { label: "Dishes mapped", value: "42+" },
  { label: "Interest match", value: "92%" },
  { label: "Dietary checks", value: "24/7" },
];

const featureCards = [
  {
    icon: BrainCircuit,
    title: "AI menu reading",
    text: "Reads the menu, flags ingredients, and translates flavour notes into your own familiar cues.",
  },
  {
    icon: ShieldCheck,
    title: "Safety guardrails",
    text: "Highlights pork, dairy, spice, and gluten signals before you order.",
  },
  {
    icon: UtensilsCrossed,
    title: "Taste bridge",
    text: "Turns unfamiliar dishes into home-cuisine analogies such as curry, comfort stew, or smoky grill.",
  },
];

const featuredDishes = [
  {
    name: "Bucatini all’Amatriciana",
    cuisine: "Italian",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
    tag: "Smoky · tangy · hearty",
  },
  {
    name: "Cacio e Pepe",
    cuisine: "Roman",
    image:
      "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80",
    tag: "Creamy · peppery · rich",
  },
  {
    name: "Aglio e Olio",
    cuisine: "Italian",
    image:
      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80",
    tag: "Garlicky · light · aromatic",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-20">
      <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-300">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            Built for first bites abroad
          </div>
          <h1 className="max-w-2xl text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl">
            Every menu,
            <span className="text-zinc-500"> translated to home.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400">
            PreBite turns an unfamiliar restaurant menu into your comfort zone:
            sensory cues, dietary checks, local pronunciation, and AI-guided
            recommendations.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/menu/upload"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[0.98]"
            >
              <UploadCloud className="h-4 w-4" />
              Upload Restaurant Menu
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20">
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
            <img
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80"
              alt="Restaurant dining scene"
              className="h-72 w-full object-cover"
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/90 p-3"
              >
                <p className="text-2xl font-semibold text-white">
                  {metric.value}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {featureCards.map(({ icon: Icon, title, text }) => (
          <article
            key={title}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
          >
            <div className="mb-4 inline-flex rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-blue-400">
              <Icon className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
          </article>
        ))}
      </section>

      <section className="mt-16 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-400">
              Featured dishes
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              A few menu moments worth trying
            </h2>
          </div>
          <Link
            href="/menu/upload"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white"
          >
            Open menu upload
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {featuredDishes.map((dish) => (
            <article
              key={dish.name}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
            >
              <img
                src={dish.image}
                alt={dish.name}
                className="h-52 w-full object-cover"
              />
              <div className="p-4">
                <div className="mb-2 inline-flex rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                  {dish.cuisine}
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {dish.name}
                </h3>
                <p className="mt-2 text-sm text-zinc-400">{dish.tag}</p>
                <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-blue-400" />
                    Remote image
                  </span>
                  <span>AI match</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
