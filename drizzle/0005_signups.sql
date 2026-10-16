CREATE TABLE "signups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"respondent" text NOT NULL,
	"level" text NOT NULL,
	"username" text,
	"time_control" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "signups_name" ON "signups" USING btree (lower("name"));--> statement-breakpoint
INSERT INTO "signups" ("name", "respondent", "level", "username", "time_control") VALUES
  ('Pavlo Butynets', 'Pavlo Butynets', 'Beginner', 'Pavlo', '10+0'),
  ('Emilian Khalus', 'Emilian Khalus', 'Beginner', 'Emil0909', NULL),
  ('Ivan Ostapiv', 'Ivan Ostapiv', 'Beginner', 'iostapiv', '5/10'),
  ('Vasyl Shtenovych', 'Vasyl Shtenovych', 'Beginner', 'vshtenovych', 'до 10хв)'),
  ('Maksym Shevchuk', 'Maksym Shevchuk', 'Beginner', 'Shevik11', 'idk what the hell it is'),
  ('Yura Shambora', 'Yura Shambora', 'Advanced', 'shmbr', '3 or 5'),
  ('Andrew Salad', 'Andrew Salad', 'Advanced', 'BlunderLogic', '15-60 min'),
  ('Vladyslav Vybyranyi', 'Vladyslav Vybyranyi', 'Beginner', 'SkyWell55', 'No idea what that is'),
  ('Solomiia Demkiv', 'Solomiia Demkiv', 'Beginner', 'mia8x8', NULL),
  ('Nadiia Kunkevych', 'Nadiia Kunkevych', 'Beginner', 'nadiiavelyka', 'regardless'),
  ('Markiyan Fostyak', 'Markiyan Fostyak', 'Beginner', 'mar-ki-yan', 'What is this?'),
  ('Sofiia Roman', 'Sofiia Roman', 'Beginner', 'SonyaaaaR', 'the more the better 😂'),
  ('Ihor Prots', 'Ihor Prots', 'Beginner', 'CerberFox', NULL),
  ('test1', 'test1', 'Beginner', NULL, NULL),
  ('123', '123', 'Beginner', NULL, NULL),
  ('123regr', '123regr', 'Beginner', NULL, NULL);