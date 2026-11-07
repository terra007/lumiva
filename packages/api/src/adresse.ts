/** Öffentliche Adresse von LUMIVA für Webhook, Rücksprung und QR-Code. */
export function oeffentlicheUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.LUMIVA_URL ?? env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
