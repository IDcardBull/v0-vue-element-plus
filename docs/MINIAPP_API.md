# 零售端小程序 × 管理端后台 · 数据对接文档

本文档面向 **零售端微信小程序** 开发者，说明如何与本仓库的 NestJS 后端（下文简称「后端」）完成数据对接。管理端（Vue Element Plus 项目）与小程序共用同一套后端、同一份数据库，管理端发布/下架商品、修改库存、处理订单的结果，小程序会立即看到。

> 后端版本：参见 `server/` 目录，当前 commit 的路由以 **§3 当前真实路由清单** 为准。

---

## 目录

1. [对接架构](#1-对接架构)
2. [本地调试环境准备](#2-本地调试环境准备)
3. [当前真实路由清单（已落地）](#3-当前真实路由清单已落地)
4. [通用约定](#4-通用约定)
5. [鉴权流程](#5-鉴权流程)
6. [小程序端 request 封装](#6-小程序端-request-封装)
7. [零售端业务接口规范（部分待后端补齐）](#7-零售端业务接口规范部分待后端补齐)
8. [典型业务流程](#8-典型业务流程)
9. [管理端 ↔ 小程序 数据一致性说明](#9-管理端--小程序-数据一致性说明)
10. [错误码对照](#10-错误码对照)
11. [附录：环境变量](#11-附录环境变量)

---

## 1. 对接架构

```
        ┌───────────────────────────┐          ┌──────────────────────┐
        │  管理端 Web (Vite+Vue3)    │          │  零售端 微信小程序    │
        │  /admin/*                 │          │  /client/*           │
        └────────────┬──────────────┘          └──────────┬───────────┘
                     │ Bearer Token (userType=admin)      │ Bearer Token (userType=client)
                     ▼                                    ▼
                ┌────────────────────────────────────────────────────┐
                │           NestJS 后端  http://<host>:3001/api       │
                │   - JwtAuthGuard + @Public()                       │
                │   - 统一响应信封 { code, data, message }           │
                └───────────────────────┬────────────────────────────┘
                                        ▼
                                ┌───────────────┐
                                │  MySQL / PG   │  Prisma ORM
                                └───────────────┘
```

两端复用同一张 `User` 表，通过字段 `userType` 区分（`admin` / `client` / `distributor`）。
同一条商品、订单、库存记录在后台与小程序之间是**实时同步**的——管理员把商品下架，小程序下次请求即看不到。

---

## 2. 本地调试环境准备

### 2.1 启动后端

```bash
cd server
cp .env.example .env              # 首次执行
pnpm install
pnpm prisma migrate deploy        # 初始化/迁移表结构
pnpm prisma db seed               # 可选：塞入管理端种子数据
pnpm start:dev                    # nest start --watch，默认监听 3001
```

启动成功后，访问 `http://localhost:3001/api/admin/auth/login` 返回 `{"code":400,...}` 即说明服务已启。

### 2.2 让手机 / 微信开发者工具连通你的电脑

因为小程序不能访问 `localhost`，需要用 **内网 IP** 或 **内网穿透**：

**方式 A · 同一 Wi-Fi（推荐本地调试）**
```bash
# macOS / Linux
ipconfig getifaddr en0     # 例如：192.168.1.23

# Windows
ipconfig                   # 查看 IPv4 地址
```
小程序里把 `baseURL` 设为 `http://192.168.1.23:3001/api`。

**方式 B · 内网穿透（外网访问，适合真机联调）**
可用 ngrok / frp / cpolar 等，将 `3001` 端口映射为 HTTPS 域名，例如
`https://yangming-api.xxx.ngrok.app/api`。

### 2.3 微信开发者工具设置

`详情 → 本地设置`：
- ✅ 勾选 **不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**（仅开发阶段）
- ❗ 真机预览若用内网 IP，需开启「调试」模式；**真机发布版必须是 HTTPS 且在小程序后台 request 合法域名中配置**

### 2.4 CORS

后端 `main.ts` 中已设置 `origin: true, credentials: true`，小程序所有 `wx.request` 默认可通过。

---

## 3. 当前真实路由清单（已落地）

> **所有接口统一前缀** `/api`。带 [PUB] 的无需 Token，带 [JWT] 的必须在 Header 带 `Authorization: Bearer <token>`。

### 3.1 小程序专用（`/api/client/*`）

| 方法 | 路径 | 鉴权 | 说明 |
| ---- | ---- | ---- | ---- |
| POST | `/client/auth/mini-login`     | [PUB] | 微信登录（jscode2session） |
| POST | `/client/auth/wechat-login`   | [PUB] | 同上，文档常用别名 |
| POST | `/client/auth/phone-login`    | [PUB] | 手机号 + 验证码登录（开发期固定码 `123456`） |
| POST | `/client/auth/bind-phone`     | [JWT] | 已登录用户绑定/换绑手机号 |

> 🚧 **其他小程序业务接口（商品、地址、订单、支付）尚未实现**。见 §7 规范草案，请向后端开发同学确认补齐计划。

### 3.2 小程序可直接借用的公开接口

管理端有几个 `@Public()` 端点不需要鉴权，小程序可直接调用（作为 §7 接口补齐前的临时方案）：

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| GET  | `/admin/brands/all`       | 全部启用中的品牌，用于筛选器 |
| GET  | `/admin/categories/tree`  | 分类树，用于首页/分类页 |

> 🚨 临时方案仅限开发期，正式上线前务必改为 `/client/*`。

### 3.3 管理端（仅供管理员使用，小程序不要调用）

为了让你了解可写入到小程序的数据来自哪里，列出几条常用管理端接口：

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| POST | `/admin/auth/login`               | 管理员登录 |
| GET  | `/admin/products`                 | 商品分页（支持筛选） |
| POST | `/admin/products`                 | 创建商品 |
| PATCH| `/admin/products/:id/status`      | 上/下架 |
| PATCH| `/admin/products/:id/channel`     | 切换零售/批发可见 |
| GET  | `/admin/orders`                   | 订单分页 |
| POST | `/admin/orders/:id/ship`          | 发货 |
| POST | `/admin/orders/:id/refund`        | 退款 |
| POST | `/admin/inventory/stock-in`       | 入库 |
| ……  | ……                                | 全部清单见 `server/src/modules/*/*.controller.ts` |

---

## 4. 通用约定

### 4.1 Base URL

| 环境 | Base URL |
| ---- | -------- |
| 本地开发 | `http://<你的内网 IP>:3001/api` |
| 预发布   | `https://api-stg.example.com/api` |
| 生产     | `https://api.example.com/api` |

### 4.2 请求头

| Header | 示例 | 必须？ |
| ------ | ---- | ------ |
| `Content-Type`   | `application/json` | POST/PUT/PATCH 需要 |
| `Authorization`  | `Bearer eyJhbGciOi...` | 受保护接口必须 |
| `X-Client`       | `miniapp` | 可选，便于后端埋点 |

### 4.3 统一响应信封

**所有成功响应**由后端 `ResponseInterceptor` 包装为：

```json
{
  "code": 0,
  "data": { /* 实际业务数据 */ },
  "message": "ok"
}
```

**所有异常响应**由 `HttpExceptionFilter` 包装为：

```json
{
  "code": 400,
  "data": null,
  "message": "参数错误：phone 不能为空"
}
```

`code === 0` 表示成功；其他值等同于 HTTP 状态码（400/401/403/404/500 等）。

### 4.4 分页请求 / 响应

**请求参数**：`page` (默认 1)、`pageSize` (默认 20)，其余业务字段并列在 query 中。

**响应 `data`**：

```json
{
  "list": [ /* ... */ ],
  "total": 123,
  "page": 1,
  "pageSize": 20
}
```

### 4.5 数值/ID 类型注意事项

- **订单 ID（`Order.id`）使用 BigInt**，后端已自动序列化为字符串。小程序侧请**全程当作字符串处理**，避免 JS Number 精度丢失。
- 金额字段（`totalAmount`、`paidAmount` 等）为 **Decimal**，后端已转为 number，单位 **元**，保留两位小数。

---

## 5. 鉴权流程

### 5.1 微信登录（推荐）

前提：小程序已在微信开放平台拿到 `AppID`，并在 `server/.env` 填入 `WX_APPID` + `WX_SECRET`。

```
小程序                              后端
  │                                  │
  │ wx.login() ──────── code ────────│
  │                                  │
  │ POST /client/auth/wechat-login   │
  │   body: { code }                 │
  │─────────────────────────────────>│
  │                                  │  1. jscode2session -> openId
  │                                  │  2. upsert User { userType: 'client', openId }
  │                                  │  3. 签 JWT
  │ <────────── { token, userInfo } ─│
  │                                  │
  │ 存 token 到 wx.setStorageSync    │
```

**请求**
```
POST /api/client/auth/wechat-login
Content-Type: application/json

{ "code": "081Xxxx..." }
```

**响应 `data`**
```json
{
  "token": "eyJhbGciOi...",
  "userInfo": {
    "id": 42,
    "openId": "oxxxxxx",
    "nickname": "微信用户_xxx",
    "avatar": "",
    "phone": null,
    "hasPhone": false
  }
}
```

如果 `hasPhone === false`，建议引导用户走 §5.3 绑定手机号。

### 5.2 手机号验证码登录（开发期方便测试）

开发期固定验证码 `123456`（见 `client-auth.service.ts`）。

```
POST /api/client/auth/phone-login
Content-Type: application/json

{ "phone": "13800138000", "code": "123456" }
```

响应同 §5.1。

### 5.3 绑定手机号

登录后调用：

```
POST /api/client/auth/bind-phone
Authorization: Bearer <token>

{ "phone": "13800138000", "code": "123456" }
```

### 5.4 Token 使用

所有受保护接口：

```http
GET /api/client/orders
Authorization: Bearer eyJhbGciOi...
```

Token 过期或无效时后端返回 `{ code: 401, message: 'Unauthorized' }`，小程序应：
1. 清除本地 `token`；
2. 跳转登录页重新走 §5.1 / §5.2。

---

## 6. 小程序端 request 封装

建议在小程序项目 `utils/request.js` 放一个统一封装：

```js
// utils/request.js
const BASE_URL = 'http://192.168.1.23:3001/api'  // 改成你的内网 IP

function getToken () {
  return wx.getStorageSync('token') || ''
}

function redirectToLogin () {
  wx.removeStorageSync('token')
  wx.reLaunch({ url: '/pages/login/login' })
}

export function request (options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        Authorization: getToken() ? `Bearer ${getToken()}` : '',
        ...(options.header || {}),
      },
      success: (res) => {
        const body = res.data || {}
        if (res.statusCode === 401 || body.code === 401) {
          redirectToLogin()
          return reject(new Error('未登录'))
        }
        if (body.code === 0) return resolve(body.data)
        wx.showToast({ title: body.message || '请求失败', icon: 'none' })
        reject(body)
      },
      fail: (err) => {
        wx.showToast({ title: '网络异常', icon: 'none' })
        reject(err)
      },
    })
  })
}

export const http = {
  get:    (url, data) => request({ url, method: 'GET',    data }),
  post:   (url, data) => request({ url, method: 'POST',   data }),
  put:    (url, data) => request({ url, method: 'PUT',    data }),
  patch:  (url, data) => request({ url, method: 'PATCH',  data }),
  delete: (url, data) => request({ url, method: 'DELETE', data }),
}
```

**登录调用示例**

```js
// pages/login/login.js
import { http } from '../../utils/request'

Page({
  async onWechatLogin () {
    const { code } = await wx.login()
    const { token, userInfo } = await http.post('/client/auth/wechat-login', { code })
    wx.setStorageSync('token', token)
    wx.setStorageSync('userInfo', userInfo)
    wx.switchTab({ url: '/pages/index/index' })
  },
})
```

---

## 7. 零售端业务接口规范（部分待后端补齐）

> 🚧 以下接口目前后端**尚未全部实现**。下表是与管理端数据模型严格对齐的规范草案，小程序开发可按此签约，推动后端按约定补齐，或让 v0 一次性生成实现。已实现的会明确标注 `[已落地]`。

### 7.1 商品

| 方法 | 路径 | 鉴权 | 状态 | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| GET  | `/client/products`                 | [PUB] | TODO | 商品列表分页 |
| GET  | `/client/products/:id`             | [PUB] | TODO | 商品详情（含 SKU、阶梯价为 null） |
| GET  | `/client/products/recommend`       | [PUB] | TODO | 首页推荐（按销量或手动置顶） |
| GET  | `/client/categories/tree`          | [PUB] | TODO | 分类树（暂用 `/admin/categories/tree` 代替） |
| GET  | `/client/brands`                   | [PUB] | TODO | 品牌列表（暂用 `/admin/brands/all` 代替） |

**`GET /client/products` Query**

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `keyword` | string | 名称/编码模糊 |
| `categoryId` | number | 分类 ID |
| `brandId` | number | 品牌 ID |
| `sort` | `sales_desc` / `price_asc` / `price_desc` / `latest` | 排序 |
| `page` / `pageSize` | number | 分页 |

**返回商品对象示例**

```json
{
  "id": 1,
  "name": "青花瓷盖碗茶具（10头）",
  "code": "YM-TEA-001",
  "coverImage": "https://cdn/.../1.jpg",
  "images": ["https://cdn/.../1.jpg", "..."],
  "brand": { "id": 2, "name": "景德镇" },
  "category": { "id": 5, "name": "茶具" },
  "retailPrice": 898.00,
  "marketPrice": 1280.00,
  "stock": 42,
  "sales": 128,
  "status": 1,
  "skus": [
    { "id": 11, "name": "礼盒装", "price": 898, "stock": 30, "image": "..." },
    { "id": 12, "name": "散装",   "price": 680, "stock": 12, "image": "..." }
  ]
}
```

过滤规则（后端应实现）：
- 自动只返回 `status = 1`（上架）且 `retailEnabled = true`（零售开启）的商品。

### 7.2 用户资料

| 方法 | 路径 | 鉴权 | 状态 | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| GET   | `/client/user/profile` | [JWT] | TODO | 获取个人资料 |
| PATCH | `/client/user/profile` | [JWT] | TODO | 修改昵称、头像 |

### 7.3 收货地址

| 方法 | 路径 | 鉴权 | 状态 | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| GET    | `/client/addresses`                 | [JWT] | TODO | 我的地址列表 |
| POST   | `/client/addresses`                 | [JWT] | TODO | 新增 |
| PUT    | `/client/addresses/:id`             | [JWT] | TODO | 更新 |
| DELETE | `/client/addresses/:id`             | [JWT] | TODO | 删除 |
| PATCH  | `/client/addresses/:id/default`     | [JWT] | TODO | 设为默认 |

**`POST /client/addresses` Body**

```json
{
  "receiver": "张三",
  "phone": "13800138000",
  "province": "浙江省",
  "city": "杭州市",
  "district": "西湖区",
  "detail": "文三路 259 号",
  "isDefault": true
}
```

### 7.4 订单

| 方法 | 路径 | 鉴权 | 状态 | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| POST  | `/client/orders`                 | [JWT] | TODO | 创建订单 |
| GET   | `/client/orders`                 | [JWT] | TODO | 我的订单（支持 status 过滤） |
| GET   | `/client/orders/:id`             | [JWT] | TODO | 订单详情 |
| PATCH | `/client/orders/:id/cancel`      | [JWT] | TODO | 取消未支付订单 |
| PATCH | `/client/orders/:id/confirm`     | [JWT] | TODO | 确认收货 |

**临时方案**：后端有 `POST /admin/orders/client/create`（已 @JWT）可作为下单接口临时使用，入参格式与下面一致：

```json
{
  "channel": "retail",
  "items": [
    { "skuId": 11, "qty": 2 }
  ],
  "addressId": 7,
  "remark": "请在工作日送达",
  "payMethod": "wechat",
  "source": "miniapp"
}
```

**订单状态取值**

| 值 | 含义 |
| ---- | ---- |
| `pending_pay`   | 待支付 |
| `pending_ship`  | 待发货 |
| `shipped`       | 已发货 |
| `completed`     | 已完成 |
| `after_sale`    | 售后中 |
| `closed`        | 已关闭 |

### 7.5 微信支付

| 方法 | 路径 | 鉴权 | 状态 | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| POST | `/client/pay/wechat-prepay`   | [JWT] | TODO | 生成 `wx.requestPayment` 所需参数 |
| POST | `/client/pay/wechat-notify`   | [PUB] | TODO | 微信回调；不允许小程序直调 |

**`POST /client/pay/wechat-prepay` Body**

```json
{ "orderId": "10001" }
```

**响应 `data`**

```json
{
  "timeStamp": "1735689600",
  "nonceStr":  "e3f1c7a2d4f0b1",
  "package":   "prepay_id=wx12...",
  "signType":  "RSA",
  "paySign":   "MEUCIQDxxxxx..."
}
```

小程序端：

```js
const payParams = await http.post('/client/pay/wechat-prepay', { orderId })
await wx.requestPayment(payParams)
```

---

## 8. 典型业务流程

### 8.1 浏览 → 下单 → 支付 → 收货

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. wx.login → /client/auth/wechat-login → 拿 token                   │
│ 2. /client/categories/tree + /client/products  渲染首页              │
│ 3. /client/products/:id   进商品详情                                 │
│ 4. 本地 storage 维护购物车（本地对象，不落库）                       │
│ 5. /client/addresses  选择收货地址                                   │
│ 6. POST /client/orders  提交订单 → 返回 orderId + 状态 pending_pay   │
│ 7. POST /client/pay/wechat-prepay { orderId } → 微信支付参数         │
│ 8. wx.requestPayment  → 用户付款                                     │
│ 9. 微信回调  /client/pay/wechat-notify → 后端将订单置 pending_ship   │
│ 10. 管理员在 /admin/orders 发货 → 前端轮询或手动刷新看到 shipped     │
│ 11. 用户 /client/orders/:id/confirm 确认收货 → completed              │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 数据时效性

- 商品库存、上/下架、价格 —— **实时生效**（小程序每次请求都是实时库存）。
- 订单状态变更（发货、退款）—— 小程序可选择「页面每次 `onShow` 重新拉取」，或者针对订单详情页接入 5~10s 轮询。
- 无需额外 WebSocket 推送，除非后续做客服消息。

---

## 9. 管理端 ↔ 小程序 数据一致性说明

| 管理端操作 | 小程序立刻可见的效果 |
| ---------- | -------------------- |
| 新建商品并上架 (`/admin/products` + `/admin/products/:id/status`) | 小程序列表出现该商品 |
| 修改商品零售价 (`PUT /admin/products/:id`) | 下次进详情看到新价；已加入购物车的本地价不会变，以**提交订单时后端重新计算**为准 |
| 下架商品 (`status → 0`) | 列表隐藏；已有未支付订单仍可支付（后端允许） |
| 仓库入库 (`/admin/inventory/stock-in`) | 商品列表实时显示最新库存 |
| 发货 (`/admin/orders/:id/ship`) | 订单详情轮询后更新为「已发货 + 物流信息」 |
| 退款 (`/admin/orders/:id/refund`) | 订单变为 `after_sale`，小程序订单页应显示「售后中」tag |

**金额计算规则**（后端 `OrderService.createOrder` 的真实逻辑，小程序勿本地拼总价）：
- 零售订单：`sum(sku.retailPrice * qty)`
- 批发订单：根据 `PriceTierService` 匹配对应阶梯价（小程序暂不涉及）
- 运费 `freight` 当前从入参传入；小程序应在结算页让用户看到，金额由后端最终确认
- 优惠券 / 积分：尚未实现

---

## 10. 错误码对照

| code | 含义 | 小程序建议处理 |
| ---- | ---- | ---------------- |
| 0    | 成功 | — |
| 400  | 参数错误 | toast 提示 `message` |
| 401  | 未登录 / Token 过期 | 清除本地 token + 跳登录 |
| 403  | 无权限（如 userType 不对） | toast 提示 |
| 404  | 资源不存在 | 空状态 UI |
| 409  | 冲突（库存不足、订单状态不允许操作） | toast 提示 `message` |
| 500  | 服务器错误 | toast「服务繁忙，请稍后重试」 |

---

## 11. 附录：环境变量

`server/.env` 中与小程序相关的变量：

```dotenv
# 运行端口
PORT=3001

# 数据库
DATABASE_URL="mysql://root:root@localhost:3306/yangming"

# JWT 签发密钥（两端共用，换了所有用户都要重新登录）
JWT_SECRET="please-change-me"
JWT_EXPIRES_IN="7d"

# 微信小程序（走 /client/auth/wechat-login 必填）
WX_APPID="wx1234567890abcdef"
WX_SECRET="0123456789abcdef0123456789abcdef"

# 微信支付（走 /client/pay/* 必填，V3 API）
WXPAY_MCH_ID=""            # 商户号
WXPAY_SERIAL_NO=""         # 商户证书序列号
WXPAY_PRIVATE_KEY_PATH=""  # apiclient_key.pem 绝对路径
WXPAY_API_V3_KEY=""        # APIv3 密钥
WXPAY_NOTIFY_URL=""        # 例如 https://xxx.ngrok.app/api/client/pay/wechat-notify
```

> 不想真机走微信登录时，可以不配置 `WX_APPID`，直接使用 §5.2 手机号登录；`/client/auth/wechat-login` 会在无配置时返回 401，便于前端兜底。

---

## 联系人 & 维护

- 后端仓库：`server/`
- 管理端仓库：仓库根目录（Vue + Element Plus）
- 小程序仓库：另行建立
- 任何路由变更请同步更新本文件 §3 与 §7。
