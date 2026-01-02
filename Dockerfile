# ==================================
# Base Stage
# ==================================
FROM node:20-alpine AS base

WORKDIR /app

# Копируем package files
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production && \
    npm cache clean --force

# ==================================
# Build Stage
# ==================================
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package files
COPY package*.json ./
COPY tsconfig.json ./

# Устанавливаем все зависимости (включая dev)
RUN npm ci

# Копируем исходный код
COPY src ./src

# Компилируем TypeScript
RUN npm run build

# ==================================
# API Stage
# ==================================
FROM node:20-alpine AS api

WORKDIR /app

# Копируем production зависимости из base
COPY --from=base /app/node_modules ./node_modules

# Копируем скомпилированный код
COPY --from=builder /app/dist ./dist

# Копируем package.json для запуска
COPY package.json ./

# Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]

# ==================================
# Worker Stage
# ==================================
FROM node:20-alpine AS worker

WORKDIR /app

# Копируем production зависимости из base
COPY --from=base /app/node_modules ./node_modules

# Копируем скомпилированный код
COPY --from=builder /app/dist ./dist

# Копируем package.json для запуска
COPY package.json ./

# Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

ENV NODE_ENV=production

CMD ["node", "dist/worker.js"]

