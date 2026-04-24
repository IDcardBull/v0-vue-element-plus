# 央茗陶瓷一库多端系统 - 部署与调试指南

## 一、项目总览

这是一个"一库多端"陶瓷电商系统，一个数据库同时服务三个终端：

```
┌─────────────────────────────────────────────────────────────┐
│   腾讯云 CVM 服务器 (Ubuntu 22.04 / 2核 4G 起步)              │
│                                                               │
│   ┌────────────────────────────────────────────────┐         │
│   │  Nginx :80/:443（反向代理 + 静态托管）          │         │
│   │   admin.yourdomain.com  →  /var/www/admin      │         │
│   │   api.yourdomain.com    →  127.0.0.1:3001      │         │
│   └────────────────────────────────────────────────┘         │
│           │                             │                     │
│           ▼                             ▼                     │
│   ┌───────────────┐              ┌─────────────────┐         │
│   │ 前端 Vue dist │              │ NestJS :3001     │         │
│   │ (静态文件)     │              │ (PM2 守护)       │         │
│   └───────────────┘              └─────────────────┘         │
│                                         │                     │
│                             ┌───────────┴──────────┐         │
│                             ▼                      ▼         │
│                    ┌──────────────┐        ┌──────────┐     │
│                    │  MySQL 8.0   │        │  Redis   │     │
│                    │ (腾讯云 CDB  │        │(可选缓存)│     │
│                    │  或 Docker)  │        └──────────┘     │
│                    └──────────────┘                           │
└─────────────────────────────────────────────────────────────┘
       ▲                                            ▲
       │ HTTPS + JWT                                │ HTTPS + JWT
       │                                            │
┌──────┴─────────┐                        ┌────────┴────────┐
│  PC 管理端     │                        │ 微信小程序       │
│  (浏览器访问)  │                        │  零售端 + 批发端 │
└────────────────┘                        └─────────────────┘
```

## 二、仓库目录结构

```
v0-vue-element-plus/
├── src/                    # PC 前端（Vue 3 + Element Plus）
│   ├── api/                # 15 个 API 封装文件
│   ├── stores/auth.ts      # Pinia 登录态
│   ├── views/              # 14 个业务页面
│   └── router/index.ts     # 路由 + 守卫
├── server/                 # NestJS 后端
│   ├── prisma/
│   │   ├── schema.prisma   # 16 张业务表
│   │   └── seed.ts         # 种子数据
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   └── modules/        # auth/product/order/inventory/...
│   └── package.json
├── docker-compose.yml      # MySQL + Redis + 后端 + 前端
├── Dockerfile.web          # 前端打包镜像
├── server/Dockerfile       # 后端打包镜像
├── nginx.conf              # 前端容器 Nginx 配置
└── docs/
    ├── DEPLOYMENT.md       # 本文件
    └── MINIPROGRAM_PROMPT.md
```

## 三、本地开发（Windows / macOS）

### 1. 环境要求

| 组件 | 版本 | 下载 |
|---|---|---|
| Node.js | ≥ 20.11 LTS | https://nodejs.org |
| pnpm | ≥ 9 | `npm i -g pnpm` |
| MySQL | 8.0（或用 Docker） | https://dev.mysql.com |
| Git | ≥ 2.40 | https://git-scm.com |

### 2. 克隆并安装

```bash
git clone git@github.com:IDcardBull/v0-vue-element-plus.git
cd v0-vue-element-plus

# 安装前端依赖
pnpm install

# 安装后端依赖
cd server
pnpm install
cd ..
```

### 3. 启动 MySQL（二选一）

**方式 A：用 Docker 本地起**
```bash
docker run -d --name ym-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=yangming123 \
  -e MYSQL_DATABASE=yangming \
  mysql:8.0
```

**方式 B：已安装 MySQL**
```sql
CREATE DATABASE yangming DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. 配置后端环境变量

```bash
cd server
cp .env.example .env
```

编辑 `server/.env`：
```env
NODE_ENV=development
PORT=3001

# 数据库（本地 Docker 用下面的）
DATABASE_URL="mysql://root:yangming123@127.0.0.1:3306/yangming"

# JWT 密钥（生产环境必须改成随机 64 位字符串）
JWT_SECRET=your_random_secret_key_min_32_chars
JWT_EXPIRES_IN=7d

# CORS（开发允许所有）
CORS_ORIGIN=*

# 微信小程序（暂时空着，后续填真实值）
WECHAT_APPID=
WECHAT_SECRET=

# 腾讯云 COS（文件上传，可选，暂时空着）
TENCENT_COS_SECRET_ID=
TENCENT_COS_SECRET_KEY=
TENCENT_COS_REGION=ap-shanghai
TENCENT_COS_BUCKET=
```

### 5. 初始化数据库

```bash
cd server

# 如果 schema.prisma 的 provider 是 sqlite，改成 mysql：
#   datasource db { provider = "mysql" ... }

# 生成 Prisma Client
pnpm prisma generate

# 创建所有表
pnpm prisma db push

# 灌入种子数据（管理员、分类、商品、客户、订单等）
pnpm prisma db seed
```

种子数据会创建：
- 管理员账号：`admin` / `admin123`
- 3 个仓库、8 个商品、若干 SKU + 阶梯价
- 5 个零售客户、3 个分销商
- 若干示例订单

### 6. 启动

开**两个终端**：

终端 1 — 后端：
```bash
cd server
pnpm start:dev       # 监听 http://localhost:3001
```

终端 2 — 前端：
```bash
# 回到根目录
VITE_API_TARGET=http://127.0.0.1:3001 pnpm dev
# 或者 Windows PowerShell：
# $env:VITE_API_TARGET="http://127.0.0.1:3001"; pnpm dev
```

访问 **http://localhost:3000**，用 `admin / admin123` 登录。

### 7. 调试建议

- **前端无法联通后端**：检查 vite 终端里代理错误日志，确认 `VITE_API_TARGET` 指到了真实后端
- **Prisma 报错**：`pnpm prisma studio` 打开图形化查看数据是否正确
- **登录返回 401**：检查 `JWT_SECRET` 是否一致，以及 `admin_users` 表里是否有种子账号
- **小程序登录无响应**：确认已配置 `WECHAT_APPID` / `WECHAT_SECRET`

## 四、生产部署到腾讯云 CVM

### 方案对比

| 方案 | 适用场景 | 难度 |
|---|---|---|
| **A. Docker Compose 一键起** | 快速验证、中小规模 | ⭐ |
| **B. 手工部署 + PM2** | 精细掌控、方便调试 | ⭐⭐ |
| **C. 腾讯云 TKE 容器服务** | 高可用、自动扩缩 | ⭐⭐⭐ |

下面详细说明 **方案 A** 和 **方案 B**。

---

### 方案 A：Docker Compose（推荐先用这个）

#### 1. 服务器准备

腾讯云控制台购买一台 CVM：
- 规格：2核 4G（标准型 S5）或更高
- 系统：Ubuntu 22.04 LTS
- 带宽：3M 起步
- **安全组**务必放行端口：`22`、`80`、`443`

SSH 登录后装 Docker：
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sudo bash

# 安装 Docker Compose
sudo apt install docker-compose-plugin -y

# 允许当前用户使用 Docker
sudo usermod -aG docker $USER
newgrp docker

docker --version       # 验证
docker compose version # 验证
```

#### 2. 拉取代码

```bash
cd /opt
sudo mkdir yangming && sudo chown $USER yangming
cd yangming
git clone https://github.com/IDcardBull/v0-vue-element-plus.git .
```

#### 3. 配置生产环境变量

```bash
# 后端 .env
cat > server/.env << 'EOF'
NODE_ENV=production
PORT=3001
DATABASE_URL=mysql://yangming:CHANGE_ME_DB_PASSWORD@mysql:3306/yangming
JWT_SECRET=CHANGE_ME_random_64_chars_jwt_secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://admin.yourdomain.com
WECHAT_APPID=wxYourRealAppIdHere
WECHAT_SECRET=YourRealWechatSecretHere
EOF

# Docker Compose 根密码
cat > .env << 'EOF'
MYSQL_ROOT_PASSWORD=CHANGE_ME_root_password
MYSQL_DATABASE=yangming
MYSQL_USER=yangming
MYSQL_PASSWORD=CHANGE_ME_DB_PASSWORD
EOF
```

**务必把所有 `CHANGE_ME_xxx` 改成真实的强密码！**

#### 4. 启动

```bash
docker compose up -d --build
```

初次启动后进容器做数据库初始化：
```bash
docker compose exec server sh -c "pnpm prisma db push && pnpm prisma db seed"
```

#### 5. 配置 Nginx + HTTPS（宿主机上）

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

新建 `/etc/nginx/sites-available/yangming`：
```nginx
# 管理端
server {
    listen 80;
    server_name admin.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:8080;  # docker-compose 里前端映射端口
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# API
server {
    listen 80;
    server_name api.yourdomain.com;
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

启用并申请证书：
```bash
sudo ln -s /etc/nginx/sites-available/yangming /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 自动申请 Let's Encrypt 证书
sudo certbot --nginx -d admin.yourdomain.com -d api.yourdomain.com
```

#### 6. 域名解析

在腾讯云 DNS 解析控制台给 `admin` 和 `api` 子域名各加一条 **A 记录**指向服务器公网 IP。

#### 7. 访问

- 管理后台：`https://admin.yourdomain.com`（admin / admin123，登录后立即改密码！）
- API：`https://api.yourdomain.com/api/client/auth/wechat-login` 等

---

### 方案 B：手工部署 + PM2（更灵活）

适合希望前后端单独部署、或数据库用腾讯云 CDB 的场景。

#### 1. 服务器准备

```bash
sudo apt update
sudo apt install -y curl git nginx
# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
sudo npm install -g pnpm pm2
```

#### 2. 数据库：用腾讯云 CDB（推荐）

1. 腾讯云控制台 → 云数据库 MySQL → 创建实例（选 8.0）
2. 同 VPC 内网能互通即可
3. 创建数据库 `yangming`，账号 `yangming`
4. 把连接串记下来：`mysql://yangming:password@cdb-xxx.tencentcdb.com:3306/yangming`

#### 3. 部署后端

```bash
cd /opt/yangming/server
pnpm install
pnpm prisma generate
pnpm prisma db push
pnpm prisma db seed  # 仅首次
pnpm build

# PM2 守护进程
pm2 start dist/main.js --name yangming-api
pm2 save
pm2 startup  # 开机自启，按提示运行 sudo 命令
```

#### 4. 部署前端

```bash
cd /opt/yangming
# 在构建前先临时指定 API 地址（.env.production）
cat > .env.production << 'EOF'
VITE_API_BASE=/api
EOF

pnpm install
pnpm build

# 产物部署
sudo mkdir -p /var/www/yangming-admin
sudo cp -r dist/* /var/www/yangming-admin/
```

#### 5. Nginx 配置

`/etc/nginx/sites-available/yangming`：
```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;
    root /var/www/yangming-admin;
    index index.html;

    # 让 SPA hash 路由正确
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 代理 API
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

启用后用 certbot 加 HTTPS（同方案 A）。

---

## 五、更新发版

以后改完代码，在服务器 `/opt/yangming/` 目录：

**Docker 方式**：
```bash
git pull
docker compose up -d --build
docker compose exec server pnpm prisma migrate deploy  # 如果有新迁移
```

**手工方式**：
```bash
git pull

# 后端
cd server
pnpm install
pnpm prisma migrate deploy
pnpm build
pm2 restart yangming-api

# 前端
cd ..
pnpm install
pnpm build
sudo cp -r dist/* /var/www/yangming-admin/
```

## 六、小程序如何对接本系统

见 `docs/MINIPROGRAM_PROMPT.md`。小程序通过 `https://api.yourdomain.com` 访问所有接口，无需任何额外部署。

## 七、常见问题

| 现象 | 排查 |
|---|---|
| 浏览器访问 admin 打不开 | Nginx 状态 `sudo systemctl status nginx`、安全组是否放行 80 |
| 登录页可开但点登录 404 | 检查 Nginx 的 `/api/` 代理是否正确 |
| 登录返回 401 | `admin_users` 表里是否有账号、`JWT_SECRET` 是否正确 |
| 小程序报 `invalid code` | 检查 `WECHAT_APPID` 和小程序管理后台是否一致 |
| 前端请求 CORS 错误 | 修改后端 `CORS_ORIGIN` 为前端真实域名，重启后端 |
| Prisma migrate 卡住 | 数据库能否联通、`DATABASE_URL` 用户是否有建表权限 |
| PM2 日志 | `pm2 logs yangming-api --lines 200` |
| Nginx 日志 | `sudo tail -f /var/log/nginx/error.log` |

## 八、备份与安全

1. **数据库每天备份**：腾讯云 CDB 有自动备份，自建 MySQL 需加 crontab
2. **修改默认密码**：首次登录后立即修改 `admin` 账号密码
3. **开启防火墙**：只放行 22/80/443，3306 千万别对公网开
4. **定期升级系统**：`sudo apt update && sudo apt upgrade`
5. **开启 Fail2Ban**：防 SSH 爆破
6. **重要操作前先停机备份**：大版本升级、Schema 变更等
