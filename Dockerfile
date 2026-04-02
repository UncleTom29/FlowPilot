FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://storage.googleapis.com/flow-cli/install.sh | bash

ENV PATH="/root/.local/bin:${PATH}"
ENV NODE_ENV=production
ENV PORT=10000

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/tsconfig.json backend/tsconfig.json

RUN npm ci

COPY backend/src ./backend/src
COPY cadence ./cadence
COPY deployments ./deployments
COPY flow.json ./flow.json

RUN npm run build --workspace=backend

EXPOSE 10000

CMD ["node", "backend/dist/index.js"]
