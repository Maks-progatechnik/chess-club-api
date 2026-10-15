import { clerkMiddleware, getAuth } from '@clerk/hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY,
)

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'OPTIONS'],
  }),
)

if (clerkConfigured) {
  app.use('*', clerkMiddleware())
}

app.get('/', (c) => {
  return c.json({ ok: true })
})

app.get('/me', (c) => {
  if (!clerkConfigured) {
    return c.json({ error: 'Clerk is not configured on the API' }, 503)
  }

  const { userId } = getAuth(c)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json({ userId })
})

export default app
