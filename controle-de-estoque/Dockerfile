# deps: dependências e código-fonte; também é a imagem dos testes.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# Gera .nuxt/ (tsconfig e tipos), que o build e o vitest leem.
RUN npx nuxt prepare

FROM deps AS build
RUN npm run build

# runtime: só o servidor compilado, sem código-fonte nem dependências de desenvolvimento.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
