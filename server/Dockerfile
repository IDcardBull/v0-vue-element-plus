# ========== Stage 1: 构建 ==========
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# 拷贝 package 并安装
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# 拷贝源代码
COPY . .

# 生成 Prisma Client 并构建
RUN pnpm prisma generate
RUN pnpm build

# ========== Stage 2: 运行 ==========
FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# 拷贝构建产物和依赖
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

EXPOSE 3001

# 启动前自动执行数据库迁移（首次会建表）
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main.js"]
