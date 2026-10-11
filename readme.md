# PreBite

PreBite is a food-discovery and dining-assistant app built to help travelers and food lovers decode unfamiliar restaurant menus with confidence. It translates dishes into familiar culinary language, highlights ingredients and dietary risks, and gives the user a quick way to communicate with a waiter in their own voice.

## Why PreBite?

Traveling abroad often means facing menus written in a language you do not fully understand. The challenge is not just translation — it is also taste, texture, spice, and dietary context. PreBite bridges that gap by turning a foreign dish name into a sensory description, a practical dietary warning, and a simple phrase that can be shown to the waiter.

## Key features

- Scan or browse menu items from a curated restaurant catalog
- Translate dish names into familiar analogies and sensory descriptions
- Show dietary flags such as pork, allergens, or ingredient concerns
- Suggest user-friendly translations for speaking with staff
- Support cuisine preferences and local pronunciation styles
- Responsive dark-mode interface built for mobile-first restaurant use

## How it works

1. The user chooses a home cuisine or preferred flavor profile.
2. The app surfaces restaurant dishes with ingredient and taste information.
3. Each dish includes:
   - pronunciation guidance
   - a literal translation
   - a sensory analogy based on familiar home flavors
   - dietary safety messaging
   - a waiter-friendly phrase
4. The user can preview the pronunciation aloud and share the translation with restaurant staff.

## Tech stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Lucide React

## Project structure

```text
PreBite/
├── frontend/
│   ├── app/
│   │   ├── dish/[id]/
│   │   ├── login/
│   │   ├── scan/
│   │   ├── waiter/[id]/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── app-provider.tsx
│   │   ├── sensory-meter.tsx
│   │   ├── site-chrome.tsx
│   │   └── speech-button.tsx
│   ├── lib/
│   │   ├── cuisines.ts
│   │   └── dishes.ts
│   ├── .gitignore
│   ├── next-env.d.ts
│   ├── next.config.mjs
│   ├── package.json
│   ├── postcss.config.mjs
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── readme.md
└── .gitignore
```

## Getting started

### Prerequisites

- Node.js 18 or newer
- npm or pnpm

### Install dependencies

```bash
cd frontend
npm install
```

### Run the app locally

```bash
cd frontend
npm run dev
```

Then open http://localhost:3000 in your browser.

### Production build

```bash
cd frontend
npm run build
```

### Start production server

```bash
cd frontend
npm run start
```

## Screens and flows

- Home landing experience for browsing the concept and onboarding
- Login screen for user profile setup
- Scan page for menu discovery and filtering
- Dish detail page for sensory translation and dietary warnings
- Waiter page with a ready-to-show phrase

## Demo content

The app ships with curated Italian menu data and sample cuisine profiles, making it easy to experience the core concept without needing an external backend immediately.

## Notes

This project is designed as a polished prototype and can be extended with:

- real OCR menu scanning
- restaurant-specific menu ingestion
- multilingual AI-powered dish descriptions
- user accounts and saved preferences
- server-side APIs and persistent data storage

## License

This project is currently for educational and demo purposes.
