ALTER TABLE "praxen" ADD COLUMN "strasse" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "praxen" ADD COLUMN "plz" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "praxen" ADD COLUMN "ort" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Bisherige einzeilige Anschrift („Musterstraße 1, 1010 Wien“) aufteilen. Gleiche Regel wie anschriftZerlegen in @lumiva/domain.
UPDATE "praxen" SET "strasse" = trim(t.m[1]), "plz" = t.m[2], "ort" = trim(t.m[3])
FROM (SELECT "id", regexp_match(trim("anschrift"), '^(.*)[,\n]\s*(\d{4,5})\s+([^,\n]+)$') AS m FROM "praxen") t
WHERE t."id" = "praxen"."id" AND t.m IS NOT NULL;--> statement-breakpoint
UPDATE "praxen" SET "plz" = t.m[1], "ort" = trim(t.m[2])
FROM (SELECT "id", regexp_match(trim("anschrift"), '^(\d{4,5})\s+([^,\n]+)$') AS m FROM "praxen") t
WHERE t."id" = "praxen"."id" AND t.m IS NOT NULL AND "praxen"."plz" = '';--> statement-breakpoint
UPDATE "praxen" SET "strasse" = trim("anschrift") WHERE "plz" = '';
