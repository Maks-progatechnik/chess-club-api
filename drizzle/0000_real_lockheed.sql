CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"surname" text NOT NULL,
	"chess_com" text,
	"elo" integer DEFAULT 1200 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_chess_com" ON "accounts" USING btree (lower("chess_com"));