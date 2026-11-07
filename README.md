# LUMIVA

**Klarheit für deine Praxis.**

LUMIVA ist eine Praxissoftware für Psychotherapeut:innen in Österreich: Termine, Honorarnoten, Dokumentation und offene Aufgaben an einem Ort, im Web und als native App für iOS und Android.

Der Name kommt von lateinisch _lumen_, Licht: Nichts soll organisatorisch im Dunkeln liegen.

## Technik

- **Web:** Next.js 16, React 19, Tailwind CSS 4
- **Apps:** Expo SDK 58 mit React Native 0.88 und Expo Router
- **API:** tRPC 11, gemeinsam für Web und App
- **Datenbank:** PostgreSQL mit Drizzle ORM; Gesundheitsdaten AES-256-GCM-verschlüsselt je Praxis
- **Werkzeuge:** TypeScript 6, pnpm und Turborepo, Biome, Vitest, GitHub Actions

## Loslegen

```bash
pnpm install
cp .env.example .env
pnpm test
pnpm --filter @lumiva/web dev      # http://localhost:3000
pnpm --filter @lumiva/mobile start # Expo Go oder Simulator
```

Details für Entwickler:innen stehen in [CLAUDE.md](CLAUDE.md).
