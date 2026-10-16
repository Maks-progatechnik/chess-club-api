ALTER TABLE "accounts" ADD COLUMN "clerk_user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_clerk_user_id_unique" UNIQUE("clerk_user_id");