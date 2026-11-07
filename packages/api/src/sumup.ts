/**
 * Schmale Anbindung an die SumUp-API (https://developer.sumup.com/api).
 *
 * - Online: Checkout mit gehosteter Zahlungsseite (POST /v0.1/checkouts, hosted_checkout).
 * - Terminal: Cloud API für den SumUp Solo (POST /v0.1/merchants/{code}/readers/{id}/checkout).
 *
 * SumUp signiert Webhooks nicht. Laut Doku muss jede Benachrichtigung über die API bestätigt
 * werden (https://developer.sumup.com/online-payments/webhooks), deshalb liest LUMIVA den Status
 * immer selbst nach und vertraut nie dem Inhalt eines Webhooks.
 *
 * An SumUp gehen nur Betrag und Nummer der Honorarnote. Nie Namen, Diagnosen oder andere
 * Gesundheitsdaten, auch nicht in Fehlermeldungen.
 */

const BASIS = "https://api.sumup.com";

export type SumupZugang = {
  haendlerCode: string;
  apiSchluessel: string;
  affiliate?: { appId: string; schluessel: string } | null;
};

export type Abruf = typeof fetch;

export class SumupFehler extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Ganze Cent in den Betrag, den die Checkout-API erwartet (Euro als Zahl, z. B. 90.5). */
export function centZuEuro(cent: number): number {
  if (!Number.isInteger(cent) || cent < 0) throw new Error("Betrag muss in ganzen Cent sein");
  return Number((cent / 100).toFixed(2));
}

/** Euro-Betrag aus der API in ganze Cent. */
export function euroZuCent(euro: number): number {
  return Math.round(euro * 100);
}

export type CheckoutStatus = "PENDING" | "FAILED" | "PAID" | "EXPIRED";

export function sumupClient(zugang: SumupZugang, abruf: Abruf = fetch) {
  async function anfrage<T>(methode: "GET" | "POST", pfad: string, inhalt?: unknown): Promise<T> {
    let antwort: Response;
    try {
      antwort = await abruf(`${BASIS}${pfad}`, {
        method: methode,
        headers: {
          authorization: `Bearer ${zugang.apiSchluessel}`,
          ...(inhalt === undefined ? {} : { "content-type": "application/json" }),
        },
        body: inhalt === undefined ? undefined : JSON.stringify(inhalt),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new SumupFehler("SumUp ist nicht erreichbar.", 0);
    }
    if (!antwort.ok) {
      // Nur den Status weitergeben, nie die Antwort: sie kann Kartendaten oder Schlüssel enthalten.
      const meldung =
        antwort.status === 401
          ? "SumUp lehnt den API-Schlüssel ab."
          : antwort.status === 404
            ? "SumUp kennt das Terminal oder den Vorgang nicht."
            : `SumUp antwortet mit Fehler ${antwort.status}.`;
      throw new SumupFehler(meldung, antwort.status);
    }
    const text = await antwort.text();
    return (text ? JSON.parse(text) : {}) as T;
  }
  const code = encodeURIComponent(zugang.haendlerCode);

  return {
    /** Online-Checkout mit gehosteter Zahlungsseite. Die Seite ist 30 Minuten gültig. */
    checkoutErstellen: (e: {
      referenz: string;
      betragCent: number;
      beschreibung: string;
      webhookUrl?: string;
      zurueckUrl?: string;
    }) =>
      anfrage<{ id: string; status: CheckoutStatus; hosted_checkout_url?: string }>(
        "POST",
        "/v0.1/checkouts",
        {
          checkout_reference: e.referenz,
          amount: centZuEuro(e.betragCent),
          currency: "EUR",
          merchant_code: zugang.haendlerCode,
          description: e.beschreibung,
          return_url: e.webhookUrl,
          redirect_url: e.zurueckUrl,
          hosted_checkout: { enabled: true },
        },
      ),

    checkoutLaden: (id: string) =>
      anfrage<{ id: string; status: CheckoutStatus; amount: number; transaction_code?: string }>(
        "GET",
        `/v0.1/checkouts/${encodeURIComponent(id)}`,
      ),

    /** Koppelt einen Solo mit dem Code, den er unter Verbindungen → API anzeigt. */
    terminalKoppeln: (pairingCode: string, name: string) =>
      anfrage<{ id: string; name: string; status: string }>(
        "POST",
        `/v0.1/merchants/${code}/readers`,
        { pairing_code: pairingCode, name },
      ),

    /** Schickt den Betrag an den Solo. Bestätigt nur die Annahme, nicht die Zahlung. */
    terminalZahlung: (e: {
      terminalId: string;
      betragCent: number;
      beschreibung: string;
      webhookUrl?: string;
    }) =>
      anfrage<{ data: { client_transaction_id: string } }>(
        "POST",
        `/v0.1/merchants/${code}/readers/${encodeURIComponent(e.terminalId)}/checkout`,
        {
          total_amount: { value: e.betragCent, currency: "EUR", minor_unit: 2 },
          description: e.beschreibung,
          return_url: e.webhookUrl,
          affiliate: zugang.affiliate
            ? { app_id: zugang.affiliate.appId, key: zugang.affiliate.schluessel }
            : undefined,
        },
      ),

    terminalAbbrechen: (terminalId: string) =>
      anfrage<unknown>(
        "POST",
        `/v0.1/merchants/${code}/readers/${encodeURIComponent(terminalId)}/terminate`,
      ),

    /** Transaktion einer Terminal-Zahlung; Status SUCCESSFUL, FAILED, CANCELLED, PENDING, … */
    transaktionLaden: (clientTransactionId: string) =>
      anfrage<{ status: string; amount: number; transaction_code?: string }>(
        "GET",
        `/v2.1/merchants/${code}/transactions?client_transaction_id=${encodeURIComponent(clientTransactionId)}`,
      ),
  };
}

export type SumupClient = ReturnType<typeof sumupClient>;
