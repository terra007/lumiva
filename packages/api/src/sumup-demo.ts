/**
 * Demo-Modus: spielt SumUp nach, damit sich Terminal und QR-Zahlung ohne Händlerkonto
 * vorführen lassen. Es fließt kein Geld und es geht keine Anfrage an SumUp.
 *
 * Die Vorgänge liegen nur im Arbeitsspeicher des Serverprozesses; nach einem Neustart sind
 * offene Demo-Zahlungen weg. In Produktion nur mit LUMIVA_SUMUP_DEMO=1.
 */
import { oeffentlicheUrl } from "./adresse";
import type { CheckoutStatus, SumupClient } from "./sumup";
import { centZuEuro, SumupFehler } from "./sumup";

/** Händlercode, an dem LUMIVA das Demo-Konto erkennt. */
export const DEMO_HAENDLERCODE = "DEMO";
export const DEMO_TERMINAL = { id: "rdr_DEMO", name: "Demo-Terminal" };
/** So lange „hält die Patientin die Karte hin“, bevor die Terminal-Zahlung gelingt. */
const TERMINAL_DAUER_MS = 6_000;

export function demoErlaubt(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" || env.LUMIVA_SUMUP_DEMO === "1";
}

type DemoCheckout = { status: CheckoutStatus; amount: number; zurueck: string | null };
type DemoTransaktion = { start: number; amount: number; abgebrochen: boolean };

type DemoSpeicher = {
  checkouts: Map<string, DemoCheckout>;
  transaktionen: Map<string, DemoTransaktion>;
};
// Über Hot Reload und alle Routen eines Prozesses hinweg derselbe Speicher.
const global = globalThis as { __lumivaSumupDemo?: DemoSpeicher };
global.__lumivaSumupDemo ??= { checkouts: new Map(), transaktionen: new Map() };
const speicher = global.__lumivaSumupDemo;

export function demoCheckout(id: string): DemoCheckout | undefined {
  return speicher.checkouts.get(id);
}

/** Die Demo-Kasse „bezahlt“ und nennt die Adresse für den Rücksprung. */
export function demoCheckoutBezahlen(id: string): string | null {
  const c = speicher.checkouts.get(id);
  if (!c) return null;
  c.status = "PAID";
  return c.zurueck;
}

export function demoClient(): SumupClient {
  if (!demoErlaubt()) throw new SumupFehler("Der SumUp-Demo-Modus ist hier ausgeschaltet.", 0);
  return {
    checkoutErstellen: async (e) => {
      const id = `demo-${crypto.randomUUID()}`;
      // Rücksprung nur auf LUMIVA selbst, nie auf fremde Seiten.
      const zurueck = e.zurueckUrl?.startsWith(`${oeffentlicheUrl()}/`) ? e.zurueckUrl : null;
      speicher.checkouts.set(id, { status: "PENDING", amount: centZuEuro(e.betragCent), zurueck });
      return {
        id,
        status: "PENDING",
        hosted_checkout_url: `${oeffentlicheUrl()}/bezahlen/demo-kasse/${id}`,
      };
    },
    checkoutLaden: async (id) => {
      const c = speicher.checkouts.get(id);
      if (!c) throw new SumupFehler("SumUp kennt das Terminal oder den Vorgang nicht.", 404);
      return { id, status: c.status, amount: c.amount, transaction_code: "DEMO" };
    },
    terminalKoppeln: async (_code, name) => ({ id: DEMO_TERMINAL.id, name, status: "paired" }),
    terminalZahlung: async (e) => {
      const id = `demo-${crypto.randomUUID()}`;
      speicher.transaktionen.set(id, {
        start: Date.now(),
        amount: centZuEuro(e.betragCent),
        abgebrochen: false,
      });
      return { data: { client_transaction_id: id } };
    },
    terminalAbbrechen: async () => {
      // Bricht die jüngste noch laufende Demo-Zahlung ab, wie der echte Solo.
      for (const t of speicher.transaktionen.values())
        if (Date.now() - t.start < TERMINAL_DAUER_MS) t.abgebrochen = true;
      return {};
    },
    transaktionLaden: async (id) => {
      const t = speicher.transaktionen.get(id);
      if (!t) throw new SumupFehler("SumUp kennt das Terminal oder den Vorgang nicht.", 404);
      const status = t.abgebrochen
        ? "CANCELLED"
        : Date.now() - t.start < TERMINAL_DAUER_MS
          ? "PENDING"
          : "SUCCESSFUL";
      return { status, amount: t.amount, transaction_code: "DEMO" };
    },
  };
}
