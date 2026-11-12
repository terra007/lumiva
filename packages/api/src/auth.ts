import { expo } from "@better-auth/expo";
import { type Datenbank, schema } from "@lumiva/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";

export type AuthOptionen = {
  db: Datenbank;
  secret: string;
  baseURL: string;
  /** Zusätzliche erlaubte Herkünfte, z. B. die App ("lumiva://") oder die Expo-Webvorschau. */
  vertrauteHerkuenfte?: string[];
};

export function authErstellen({ db, secret, baseURL, vertrauteHerkuenfte = [] }: AuthOptionen) {
  return betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
      },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 60 },
    trustedOrigins: ["lumiva://", ...vertrauteHerkuenfte],
    plugins: [
      expo(),
      // Zweiter Faktor per Authenticator-App (TOTP, RFC 6238) mit Wiederherstellungscodes.
      // Art. 32 DSGVO verlangt für Gesundheitsdaten einen dem Risiko angemessenen Zugangsschutz.
      twoFactor({
        issuer: "LUMIVA",
        backupCodeOptions: { amount: 10, length: 10 },
        // Ein vertrautes Gerät fragt höchstens 30 Tage lang nicht erneut nach dem Code.
        trustDeviceMaxAge: 60 * 60 * 24 * 30,
      }),
    ],
  });
}

export type Auth = ReturnType<typeof authErstellen>;
