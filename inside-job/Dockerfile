# Inside Job: the game page plus its WebSocket relay, in one small container.
#   docker build -t inside-job . && docker run -p 8080:8080 inside-job
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/package.json /app/server.js ./
COPY --from=build /app/dist ./dist
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server.js"]
