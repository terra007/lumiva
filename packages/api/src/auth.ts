import { expo } from "@better-auth/expo";
import { type Datenbank, schema } from "@lumiva/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

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
      },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 60 },
    trustedOrigins: ["lumiva://", ...vertrauteHerkuenfte],
    plugins: [expo()],
  });
}

export type Auth = ReturnType<typeof authErstellen>;
