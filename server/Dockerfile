FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN npm i -g npm@11 >/dev/null 2>&1
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "src/index.js"]
