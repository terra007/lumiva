import { sumupWebhook } from "@lumiva/api";
import { dienste } from "@/server/lumiva";

/**
 * Benachrichtigung von SumUp über eine Zahlung (Terminal oder online). SumUp signiert Webhooks
 * nicht; deshalb zählt nur die Zahlungs-ID in der Adresse, und LUMIVA fragt den Stand selbst
 * bei SumUp nach (https://developer.sumup.com/online-payments/webhooks).
 */
export async function POST(_req: Request, { params }: RouteContext<"/api/sumup/webhook/[id]">) {
  const { id } = await params;
  const { db, hauptschluessel } = await dienste();
  try {
    await sumupWebhook({ db, hauptschluessel, zahlungId: id });
  } catch {
    // SumUp versucht es nach 1, 5 und 20 Minuten erneut. Keine Details ins Log.
    console.error("SumUp-Webhook: Abgleich fehlgeschlagen");
    return new Response(null, { status: 503 });
  }
  // Auch unbekannte IDs mit 2xx beantworten, damit SumUp nicht endlos wiederholt.
  return new Response(null, { status: 204 });
}
