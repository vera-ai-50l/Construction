# Lead pipeline + API. The Playwright image already has Chromium and its system libraries.
FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY seeds ./seeds
ENV NODE_ENV=production PORT=8787
# out/ holds runs, the HTTP cache and pipeline state: mount it as a volume.
VOLUME ["/app/out"]
EXPOSE 8787
CMD ["node", "--no-warnings", "src/server.mjs"]
