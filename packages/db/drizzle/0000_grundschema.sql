CREATE TYPE "public"."eintrag_art" AS ENUM('erstgespraech', 'verlauf', 'abschluss', 'notiz');--> statement-breakpoint
CREATE TYPE "public"."patient_status" AS ENUM('aktiv', 'pausiert', 'abgeschlossen');--> statement-breakpoint
CREATE TYPE "public"."rolle" AS ENUM('inhaber', 'therapeut', 'assistenz');--> statement-breakpoint
CREATE TYPE "public"."termin_status" AS ENUM('geplant', 'erledigt', 'abgesagt', 'nicht_erschienen');--> statement-breakpoint
CREATE TYPE "public"."versicherungstraeger" AS ENUM('oegk', 'bvaeb', 'svs', 'kfa', 'privat', 'sonstige');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aufgaben" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"praxis_id" uuid NOT NULL,
	"patient_id" uuid,
	"zustaendig_id" text NOT NULL,
	"titel" text NOT NULL,
	"faellig_am" date,
	"erledigt_am" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doku_eintraege" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"praxis_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"termin_id" uuid,
	"art" "eintrag_art" NOT NULL,
	"inhalt_enc" text NOT NULL,
	"diagnose_icd10_enc" text,
	"erstellt_von" text NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"geaendert_am" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "honorarnote_positionen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"praxis_id" uuid NOT NULL,
	"honorarnote_id" uuid NOT NULL,
	"termin_id" uuid NOT NULL,
	"honorar_cent" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "honorarnoten" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"praxis_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"jahr" integer NOT NULL,
	"laufende_nummer" integer NOT NULL,
	"ausgestellt_am" date NOT NULL,
	"summe_cent" integer NOT NULL,
	"bezahlt_am" date,
	"storniert_am" date,
	"inhalt_enc" text NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "honorarnoten_praxisId_jahr_laufendeNummer_unique" UNIQUE("praxis_id","jahr","laufende_nummer"),
	CONSTRAINT "honorarnoten_praxisId_id_unique" UNIQUE("praxis_id","id")
);
--> statement-breakpoint
CREATE TABLE "mitgliedschaften" (
	"praxis_id" uuid NOT NULL,
	"benutzer_id" text NOT NULL,
	"rolle" "rolle" NOT NULL,
	"berufsbezeichnung" text,
	"verschwiegenheit_belehrt_am" timestamp with time zone,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mitgliedschaften_praxis_id_benutzer_id_pk" PRIMARY KEY("praxis_id","benutzer_id")
);
--> statement-breakpoint
CREATE TABLE "nummernkreise" (
	"praxis_id" uuid NOT NULL,
	"jahr" integer NOT NULL,
	"letzte_nummer" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "nummernkreise_praxis_id_jahr_pk" PRIMARY KEY("praxis_id","jahr")
);
--> statement-breakpoint
CREATE TABLE "patienten" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"praxis_id" uuid NOT NULL,
	"therapeut_id" text NOT NULL,
	"vorname_enc" text NOT NULL,
	"nachname_enc" text NOT NULL,
	"geburtsdatum_enc" text NOT NULL,
	"sv_nummer_enc" text,
	"kontakt_enc" text,
	"versicherungstraeger" "versicherungstraeger" NOT NULL,
	"status" "patient_status" DEFAULT 'aktiv' NOT NULL,
	"aerztliche_bestaetigung_am" date,
	"bewilligung_am" date,
	"behandlungsende" date,
	"loeschbar_ab" date,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patienten_praxisId_id_unique" UNIQUE("praxis_id","id")
);
--> statement-breakpoint
CREATE TABLE "praxen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"anschrift" text NOT NULL,
	"telefon" text,
	"email" text,
	"iban" text,
	"datenschluessel_enc" text NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protokoll" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"praxis_id" uuid NOT NULL,
	"benutzer_id" text NOT NULL,
	"aktion" text NOT NULL,
	"objekt_typ" text NOT NULL,
	"objekt_id" uuid,
	"details" jsonb,
	"zeitpunkt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sitzungsarten" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"praxis_id" uuid NOT NULL,
	"name" text NOT NULL,
	"dauer_minuten" integer NOT NULL,
	"honorar_cent" integer NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL,
	CONSTRAINT "sitzungsarten_praxisId_id_unique" UNIQUE("praxis_id","id")
);
--> statement-breakpoint
CREATE TABLE "termine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"praxis_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"therapeut_id" text NOT NULL,
	"sitzungsart_id" uuid,
	"beginn" timestamp with time zone NOT NULL,
	"ende" timestamp with time zone NOT NULL,
	"status" "termin_status" DEFAULT 'geplant' NOT NULL,
	"serie_id" uuid,
	"honorar_cent" integer NOT NULL,
	"ausfallhonorar_cent" integer,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "termine_praxisId_id_unique" UNIQUE("praxis_id","id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aufgaben" ADD CONSTRAINT "aufgaben_praxis_id_praxen_id_fk" FOREIGN KEY ("praxis_id") REFERENCES "public"."praxen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aufgaben" ADD CONSTRAINT "aufgaben_praxis_id_patient_id_patienten_praxis_id_id_fk" FOREIGN KEY ("praxis_id","patient_id") REFERENCES "public"."patienten"("praxis_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doku_eintraege" ADD CONSTRAINT "doku_eintraege_praxis_id_praxen_id_fk" FOREIGN KEY ("praxis_id") REFERENCES "public"."praxen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doku_eintraege" ADD CONSTRAINT "doku_eintraege_praxis_id_patient_id_patienten_praxis_id_id_fk" FOREIGN KEY ("praxis_id","patient_id") REFERENCES "public"."patienten"("praxis_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doku_eintraege" ADD CONSTRAINT "doku_eintraege_praxis_id_termin_id_termine_praxis_id_id_fk" FOREIGN KEY ("praxis_id","termin_id") REFERENCES "public"."termine"("praxis_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarnote_positionen" ADD CONSTRAINT "honorarnote_positionen_praxis_id_praxen_id_fk" FOREIGN KEY ("praxis_id") REFERENCES "public"."praxen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarnote_positionen" ADD CONSTRAINT "honorarnote_positionen_praxis_id_honorarnote_id_honorarnoten_praxis_id_id_fk" FOREIGN KEY ("praxis_id","honorarnote_id") REFERENCES "public"."honorarnoten"("praxis_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarnote_positionen" ADD CONSTRAINT "honorarnote_positionen_praxis_id_termin_id_termine_praxis_id_id_fk" FOREIGN KEY ("praxis_id","termin_id") REFERENCES "public"."termine"("praxis_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarnoten" ADD CONSTRAINT "honorarnoten_praxis_id_praxen_id_fk" FOREIGN KEY ("praxis_id") REFERENCES "public"."praxen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarnoten" ADD CONSTRAINT "honorarnoten_praxis_id_patient_id_patienten_praxis_id_id_fk" FOREIGN KEY ("praxis_id","patient_id") REFERENCES "public"."patienten"("praxis_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mitgliedschaften" ADD CONSTRAINT "mitgliedschaften_praxis_id_praxen_id_fk" FOREIGN KEY ("praxis_id") REFERENCES "public"."praxen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nummernkreise" ADD CONSTRAINT "nummernkreise_praxis_id_praxen_id_fk" FOREIGN KEY ("praxis_id") REFERENCES "public"."praxen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patienten" ADD CONSTRAINT "patienten_praxis_id_praxen_id_fk" FOREIGN KEY ("praxis_id") REFERENCES "public"."praxen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protokoll" ADD CONSTRAINT "protokoll_praxis_id_praxen_id_fk" FOREIGN KEY ("praxis_id") REFERENCES "public"."praxen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitzungsarten" ADD CONSTRAINT "sitzungsarten_praxis_id_praxen_id_fk" FOREIGN KEY ("praxis_id") REFERENCES "public"."praxen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termine" ADD CONSTRAINT "termine_praxis_id_praxen_id_fk" FOREIGN KEY ("praxis_id") REFERENCES "public"."praxen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termine" ADD CONSTRAINT "termine_praxis_id_patient_id_patienten_praxis_id_id_fk" FOREIGN KEY ("praxis_id","patient_id") REFERENCES "public"."patienten"("praxis_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "termine" ADD CONSTRAINT "termine_praxis_id_sitzungsart_id_sitzungsarten_praxis_id_id_fk" FOREIGN KEY ("praxis_id","sitzungsart_id") REFERENCES "public"."sitzungsarten"("praxis_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aufgaben_praxis_id_zustaendig_id_index" ON "aufgaben" USING btree ("praxis_id","zustaendig_id");--> statement-breakpoint
CREATE INDEX "doku_eintraege_patient_id_index" ON "doku_eintraege" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "honorarnote_positionen_termin_id_index" ON "honorarnote_positionen" USING btree ("termin_id");--> statement-breakpoint
CREATE INDEX "patienten_praxis_id_therapeut_id_index" ON "patienten" USING btree ("praxis_id","therapeut_id");--> statement-breakpoint
CREATE INDEX "protokoll_praxis_id_zeitpunkt_index" ON "protokoll" USING btree ("praxis_id","zeitpunkt");--> statement-breakpoint
CREATE INDEX "protokoll_objekt_id_index" ON "protokoll" USING btree ("objekt_id");--> statement-breakpoint
CREATE INDEX "termine_praxis_id_therapeut_id_beginn_index" ON "termine" USING btree ("praxis_id","therapeut_id","beginn");--> statement-breakpoint
CREATE INDEX "termine_patient_id_index" ON "termine" USING btree ("patient_id");