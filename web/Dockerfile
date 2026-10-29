FROM node:22-alpine AS deps
WORKDIR /app
RUN npm i -g npm@11 >/dev/null 2>&1
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
# Next bakes the /api rewrite target and NEXT_PUBLIC_* values at build time.
ARG API_URL=http://server:4000
ARG NEXT_PUBLIC_SITE_URL=https://fringlale.com
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV API_URL=$API_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
