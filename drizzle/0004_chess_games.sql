CREATE TABLE "chess_game_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"external_player_id" integer NOT NULL,
	"color" text NOT NULL,
	"username" text NOT NULL,
	"rating" integer,
	"rating_change" integer,
	"rating_after" integer,
	CONSTRAINT "chess_game_players_color" CHECK ("chess_game_players"."color" in ('white', 'black'))
);
--> statement-breakpoint
CREATE TABLE "chess_games" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"external_uuid" text,
	"url" text,
	"status" text NOT NULL,
	"pace" text,
	"result" text NOT NULL,
	"winner_color" text,
	"termination" text NOT NULL,
	"termination_raw" text,
	"termination_detail" text,
	"rated" boolean,
	"variant" text,
	"variant_name" text,
	"time_class" text,
	"initial_seconds" integer,
	"increment_seconds" integer,
	"time_control_raw" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"ply_count" integer,
	"eco" text,
	"opening_name" text,
	"starting_fen" text,
	"pgn" text,
	"encoded_move_list" text,
	"move_timestamps" text,
	"source_payload" jsonb,
	"parser_version" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chess_games_status" CHECK ("chess_games"."status" in ('finished', 'ongoing', 'unknown')),
	CONSTRAINT "chess_games_result" CHECK ("chess_games"."result" in ('white_win', 'black_win', 'draw', 'unknown')),
	CONSTRAINT "chess_games_winner_color" CHECK ("chess_games"."winner_color" is null or "chess_games"."winner_color" in ('white', 'black')),
	CONSTRAINT "chess_games_pace" CHECK ("chess_games"."pace" is null or "chess_games"."pace" in ('live', 'daily')),
	CONSTRAINT "chess_games_time_class" CHECK ("chess_games"."time_class" is null or "chess_games"."time_class" in ('bullet', 'blitz', 'rapid', 'daily'))
);
--> statement-breakpoint
CREATE TABLE "external_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"external_uuid" text,
	"username" text NOT NULL,
	"country_name" text,
	"is_computer" boolean,
	"account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chess_game_players" ADD CONSTRAINT "chess_game_players_game_id_chess_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."chess_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chess_game_players" ADD CONSTRAINT "chess_game_players_external_player_id_external_players_id_fk" FOREIGN KEY ("external_player_id") REFERENCES "public"."external_players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_players" ADD CONSTRAINT "external_players_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chess_game_players_game_color" ON "chess_game_players" USING btree ("game_id","color");--> statement-breakpoint
CREATE UNIQUE INDEX "chess_game_players_game_player" ON "chess_game_players" USING btree ("game_id","external_player_id");--> statement-breakpoint
CREATE INDEX "chess_game_players_external_player_id" ON "chess_game_players" USING btree ("external_player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chess_games_provider_external_id" ON "chess_games" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "chess_games_ended_at" ON "chess_games" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "chess_games_eco" ON "chess_games" USING btree ("eco");--> statement-breakpoint
CREATE UNIQUE INDEX "external_players_provider_external_id" ON "external_players" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "external_players_account_id" ON "external_players" USING btree ("account_id");