ALTER TABLE "accounts" ADD COLUMN "signup_name" text;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_signup_name" ON "accounts" USING btree (lower("signup_name"));