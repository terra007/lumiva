ALTER TABLE "zahlungen" ALTER COLUMN "honorarnote_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "zahlungen" ADD COLUMN "termin_id" uuid;--> statement-breakpoint
ALTER TABLE "zahlungen" ADD CONSTRAINT "zahlungen_praxis_id_termin_id_termine_praxis_id_id_fk" FOREIGN KEY ("praxis_id","termin_id") REFERENCES "public"."termine"("praxis_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "zahlungen_termin_id_index" ON "zahlungen" USING btree ("termin_id");--> statement-breakpoint
ALTER TABLE "zahlungen" ADD CONSTRAINT "zahlung_ziel" CHECK (num_nonnulls("zahlungen"."honorarnote_id", "zahlungen"."termin_id") = 1);