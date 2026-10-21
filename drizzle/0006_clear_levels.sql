ALTER TABLE "signups" ALTER COLUMN "level" DROP NOT NULL;--> statement-breakpoint
UPDATE "signups" SET "level" = NULL;
