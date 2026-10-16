# Chess Club API

```sh
bun install
bun run dev
```

http://localhost:3000

Set `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `.env`.

Accounts are in Postgres. Start it with `docker compose up -d` and set `DATABASE_URL` in `.env`.

On Render, deploy with the Dockerfile. Set `DATABASE_URL` to the hosted database, not localhost. Set `CORS_ORIGINS` to the Netlify site URL.
