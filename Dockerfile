FROM oven/bun:1
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY drizzle ./drizzle

ENV NODE_ENV=production
USER bun
EXPOSE 3000
CMD ["bun", "src/index.ts"]
