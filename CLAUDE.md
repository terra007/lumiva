# LUMIVA

Praxissoftware für Psychotherapeuten in Österreich. Web-App und native Apps für iOS und Android.
Anforderungen: siehe das Anforderungsdokument „LUMIVA – Anforderungen v1“ im Projekt.

## Aufbau

pnpm-Monorepo mit Turborepo.

| Ordner            | Inhalt                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `apps/web`        | Next.js (App Router), Tailwind. Liefert auch die API unter `/api/trpc`. Lies `apps/web/AGENTS.md`. |
| `apps/mobile`     | Expo mit Expo Router für iOS, Android (und Web-Vorschau). Lies `apps/mobile/AGENTS.md`.            |
| `packages/api`    | tRPC-Router, von Web und App gemeinsam genutzt.                                                    |
| `packages/db`     | Drizzle-Schema für PostgreSQL, Migrationen in `drizzle/`, Feldverschlüsselung, Nummernkreise.      |
| `packages/domain` | Reine Fachlogik ohne I/O: Honorarnote, Kostenzuschuss-Regeln, Aufbewahrung, Geld.                  |

## Befehle

```bash
pnpm install
pnpm lint          # Biome
pnpm format        # Biome mit --write
pnpm typecheck
pnpm test          # Vitest; DB-Tests laufen gegen PGlite, ohne Server
pnpm db:generate   # neue Migration nach Schemaänderung
pnpm --filter @lumiva/web e2e   # Playwright gegen eigenen Server (Port 3100, leere Datenbank)
pnpm --filter @lumiva/web dev
pnpm --filter @lumiva/mobile start
```

Vor jedem Commit: `pnpm lint && pnpm typecheck && pnpm test`.
Neue Expo-Pakete immer mit `npx expo install <paket>` in `apps/mobile` hinzufügen.

## Regeln

- **Gesundheitsdaten nie im Klartext speichern.** Spalten mit Endung `Enc` werden mit
  `verschluesseln(wert, praxisSchluessel, "<tabelle>.<spalte>:<id>")` aus `@lumiva/db/crypto` geschrieben.
- **Keine Gesundheitsdaten in Logs, Fehlermeldungen, Push-Nachrichten oder Analytics.**
- Jede Abfrage filtert nach `praxisId`. Therapeuten sehen nur eigene Patienten; Assistenz keine Akteninhalte.
- Jeder Lese- oder Schreibzugriff auf Akten schreibt einen Eintrag in `protokoll`.
- Honorarnoten sind nach Ausstellung unveränderlich; Korrektur nur per Storno (`storniertAm`) und neuer Note.
  Nummern nur über `naechsteHonorarnoteNummer(tx, …)` innerhalb der Transaktion, die die Note speichert.
- Geld immer als ganze Cent (`integer`), nie als Kommazahl.
- Fachbegriffe auf Deutsch (Honorarnote, Kostenzuschuss, Sitzung), wie in `packages/domain`.
- **Kein Gendering.** Personen- und Rollenbezeichnungen nur in der männlichen Form, in Oberfläche, Texten,
  Kommentaren und Doku (Patient, Therapeut, Inhaber, Selbstzahler). Keine Formen wie `Patient:in`, `Patient*innen`,
  `PatientInnen` oder `Neue:r`.
- Fachregeln mit Quelle kommentieren (Gesetz und Paragraf oder URL der Kasse).

## Arbeitsweise

- Jede Änderung als Pull Request, nie direkt auf `main`.
- Vor dem PR: `/code-review` und bei Akten, Anmeldung oder Verschlüsselung zusätzlich `/security-review`; danach `/simplify`.
