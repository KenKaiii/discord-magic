# Railway builds this automatically (see .railway/railway.ts).
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.config.ts ./
COPY src ./src
USER node
EXPOSE 3000
# Node runs TypeScript directly (type stripping), so there is no build step.
CMD ["node", "src/index.ts"]
