# Chess Club API

```sh
bun install
bun run dev
```

http://localhost:3000

Set `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `.env`.

Accounts are in Postgres. Start it with `docker compose up -d` and set `DATABASE_URL` in `.env`.

On Render, deploy with the Dockerfile. Set `DATABASE_URL` to the hosted database, not localhost. Set `CORS_ORIGINS` to the Netlify site URL.

## Roles

Every signed-in user is a `member`: they can view all pages and add Chess.com games to a match they play in. They are matched to the draw by their account name.

An `organizer` can do everything: generate rounds, save draws, and add games to any match. Yura is the organizer. Set their verified Clerk email in `ORGANIZER_EMAIL`.

Roles are checked on the server. Display names are never trusted, because any user can rename themselves to Yura.

### Testing roles

1. Put your own email in `ORGANIZER_EMAIL` and restart the API.
2. Sign in. The header shows "Viewing as organizer". You can generate a round and add games to any match.
3. Click the switch to "Viewing as member". The page reloads and every request carries `X-View-As: member`, so the API treats you as a member:
   - "Generate round" is gone.
   - "Add game" shows only on matches you play in.
   - Without a club account, adding a game returns "Only club members can add games."
4. To check that the server enforces this, not just the UI, call it directly as a member. Each call returns 403 "Only the organizer can do that.":

   ```sh
   curl -X POST "$API/draws/next" -H "Authorization: Bearer $TOKEN" -H "X-View-As: member"      -H "Content-Type: application/json" -d '{"round": 99}'
   ```

   Get `$TOKEN` from the browser console with `await window.Clerk.session.getToken()`.
5. Set `ORGANIZER_EMAIL` back to Yura's email when you are done.
