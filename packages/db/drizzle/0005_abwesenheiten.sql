CREATE TABLE "abwesenheiten" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"praxis_id" uuid NOT NULL,
	"benutzer_id" text NOT NULL,
	"von" date NOT NULL,
	"bis" date NOT NULL,
	"art_enc" text NOT NULL,
	"notiz_enc" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "abwesenheit_zeitraum" CHECK ("abwesenheiten"."bis" >= "abwesenheiten"."von")
);
--> statement-breakpoint
ALTER TABLE "abwesenheiten" ADD CONSTRAINT "abwesenheiten_praxis_id_praxen_id_fk" FOREIGN KEY ("praxis_id") REFERENCES "public"."praxen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abwesenheiten_praxis_id_bis_index" ON "abwesenheiten" USING btree ("praxis_id","bis");