CREATE TYPE "public"."zahlung_art" AS ENUM('terminal', 'online');--> statement-breakpoint
CREATE TYPE "public"."zahlung_status" AS ENUM('offen', 'bezahlt', 'fehlgeschlagen', 'abgebrochen');--> statement-breakpoint
CREATE TABLE "sumup_konten" (
	"praxis_id" uuid PRIMARY KEY NOT NULL,
	"haendler_code" text NOT NULL,
	"api_schluessel_enc" text NOT NULL,
	"affiliate_app_id" text,
	"affiliate_schluessel_enc" text,
	"terminal_id" text,
	"terminal_name" text,
	"geaendert_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zahlungen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"praxis_id" uuid NOT NULL,
	"honorarnote_id" uuid NOT NULL,
	"art" "zahlung_art" NOT NULL,
	"status" "zahlung_status" DEFAULT 'offen' NOT NULL,
	"betrag_cent" integer NOT NULL,
	"anbieter_id" text,
	"zahlseite_url" text,
	"transaktion_code" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"abgeschlossen_am" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sumup_konten" ADD CONSTRAINT "sumup_konten_praxis_id_praxen_id_fk" FOREIGN KEY ("praxis_id") REFERENCES "public"."praxen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zahlungen" ADD CONSTRAINT "zahlungen_praxis_id_praxen_id_fk" FOREIGN KEY ("praxis_id") REFERENCES "public"."praxen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zahlungen" ADD CONSTRAINT "zahlungen_praxis_id_honorarnote_id_honorarnoten_praxis_id_id_fk" FOREIGN KEY ("praxis_id","honorarnote_id") REFERENCES "public"."honorarnoten"("praxis_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "zahlungen_honorarnote_id_index" ON "zahlungen" USING btree ("honorarnote_id");