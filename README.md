# 央茗陶瓷 · 一库多端系统

Vue 3 + TypeScript + Element Plus 管理后台，NestJS + Prisma + MySQL 后端，面向微信小程序（零售端/批发端）、H5、PC 管理端三端数据互通。

---

## 一、架构总览

```
┌────────────────────────────────────────────────────────────┐
│                      腾讯云 CVM                             │
│                                                              │
│   Nginx (80/443)                                             │
│     ├─ admin.xxx.com   →  Vue 管理后台 (dist 静态)           │
│     └─ api.xxx.com     →  NestJS 容器 :3001 (反向代理)       │
│                                                              │
│   NestJS API                                                 │
│     ├─ /api/admin/**   →  PC 管理端                         │
│     ├─ /api/client/**  →  小程序 / H5                       │
│     └─ /api/common/**  →  三端共享                           │
│                                                              │
│   MySQL 8  ←──  Prisma ORM  ──→  16 张业务表                 │
│   Redis   ←──  会话/限流/缓存                                │
│   腾讯云 COS  ←──  商品图 / 营业执照                          │
└────────────────────────────────────────────────────────────┘
         ▲                                         ▲
         │ HTTPS + JWT                             │ HTTPS + JWT
┌────────┴─────────┐                     ┌─────────┴────────┐
│  PC 管理端       │                     │  微信小程序       │
│  Vue3 + ElPlus   │                     │  零售/批发端     │
└──────────────────┘                     └──────────────────┘
```

**数据互通核心**：三端共用同一套 MySQL 数据库，通过 `users.openid` 锚定身份，同一张 `orders/products/stock` 表。小程序下单 → 管理端实时看到；管理端改价 → 小程序刷新即生效。

---

## 二、目录结构

```
.
├── src/                  # Vue 3 管理后台前端
├── server/               # NestJS 后端
│   ├── prisma/schema.prisma
│   └── src/modules/      # 商品/订单/库存/用户/账号/角色/日志...
├── docker-compose.yml    # 一键启动 MySQL+Redis+后端+前端
├── Dockerfile.web
├── nginx.conf
└── README.md
```

---

## 三、本地开发

需要 Node 20+、pnpm 9+、MySQL 8（或用 Docker）。

```bash
# 启动后端
cd server
cp .env.example .env        # 修改 DATABASE_URL
pnpm install
pnpm prisma generate
pnpm prisma db push
pnpm prisma db seed         # 插入管理员、商品、订单等种子
pnpm start:dev              # :3001

# 启动前端（新终端）
cd ..
pnpm install
pnpm dev                    # :3000
```

打开 `http://localhost:3000`，登录账号：

| 账号 | 密码 | 角色 |
| ---- | ---- | ---- |
| admin | admin123 | 超级管理员 |
| sales | 123456 | 销售经理 |
| warehouse | 123456 | 仓库管理员 |

---

## 四、腾讯云 CVM 部署（Docker 方式）

### 1. 服务器准备

```bash
# 以 Ubuntu 22.04 为例
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

# 腾讯云控制台安全组放行 80/443/3306
```

### 2. 拉取并启动

```bash
git clone <your-repo> yangming
cd yangming
cp server/.env.example .env
vim .env                    # 改 JWT_SECRET / WECHAT_APPID 等

docker compose up -d --build
docker compose logs -f server
```

启动后访问 `http://<公网IP>`。首次需要执行种子：

```bash
docker compose exec server pnpm prisma db seed
```

### 3. HTTPS 与子域名

在腾讯云 DNS 添加 A 记录：

```
admin.yourdomain.com  →  CVM 公网 IP
api.yourdomain.com    →  CVM 公网 IP
```

申请腾讯云免费 SSL 证书后上传到 CVM，修改 `nginx.conf` 增加 443 配置，`docker compose restart web` 即可。

---

## 五、微信小程序对接

### 1. 小程序登录

```js
wx.login({
  success: async (res) => {
    const { data } = await uni.request({
      url: 'https://api.yourdomain.com/api/client/auth/wechat-login',
      method: 'POST',
      data: { code: res.code }
    })
    uni.setStorageSync('token', data.data.token)
  }
})
```

### 2. 每次请求携带 Token

```js
uni.request({
  url: 'https://api.yourdomain.com/api/client/products',
  header: { Authorization: `Bearer ${uni.getStorageSync('token')}` }
})
```

### 3. 零售端 vs 批发端：同一套后端按角色返回不同数据

- 用户 `role = 'retail'` → 返回零售价 + 会员价
- 用户 `role = 'dealer'` → 返回阶梯价 + 授信额度

因此只需要做一个 uni-app 项目（编译成零售端 + 批发端两个小程序包，或按 Tab 切换），前端根据 `user.role` 展示不同 UI。

---

## 六、常用运维

```bash
docker compose ps                              # 查看容器
docker compose restart server                  # 重启后端
docker compose up -d --build server            # 代码更新后重新构建
docker compose exec mysql mysqldump -uroot -p yangming > backup.sql
docker compose logs -f --tail=100 server       # 实时日志
```

---

## 七、环境变量

| 变量 | 说明 |
| ---- | ---- |
| `DATABASE_URL` | `mysql://user:pwd@host:3306/db` |
| `REDIS_URL` | `redis://:pwd@host:6379` |
| `JWT_SECRET` | JWT 密钥（**生产必改**，至少 32 位） |
| `WECHAT_APPID` / `WECHAT_SECRET` | 小程序 AppId / AppSecret |
| `COS_SECRET_ID` / `COS_SECRET_KEY` / `COS_BUCKET` / `COS_REGION` | 腾讯云 COS 文件存储 |

---

## 八、API 分组

- **管理端** `/api/admin/*`：商品/分类/品牌/SKU/阶梯价/库存/订单/用户/分销商/账号/角色/日志/Dashboard
- **客户端** `/api/client/*`：wechat-login、商品列表（按角色返回价格）、下单、我的订单
- **公共** `/api/common/*`：文件上传、字典

---

## 九、FAQ

**为什么选 NestJS 而不是 Java？**
小程序 + 前端都在 JS 生态，TS 前后端共享类型，减少联调 bug。若团队为 Java 背景，可换 Spring Boot，schema 不变。

**一定要 MySQL 吗？**
可换 PostgreSQL。改 `schema.prisma` 的 `provider = "postgresql"`，重新 `prisma db push` 即可。

**怎么接微信支付？**
`orders.payNo` 字段已预留，接入 `wechatpay-node-v3` SDK，支付回调调用 `ordersService.markPaid(orderId)` 即可。

---

MIT © 2026 央茗陶瓷
