FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV VITE_APP_MODE=server

COPY package.json package-lock.json ./
RUN npm ci
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm --prefix backend ci
COPY . .
RUN npm run build && npm --prefix backend run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV STATIC_ROOT=/app/dist
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm --prefix backend ci --omit=dev
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/migrations ./backend/migrations
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "backend/dist/server.js"]
