# 微信小程序（零售端）对接 AI 提示词

## 一、使用说明

复制下方**完整提示词**直接发给 v0、Claude、ChatGPT 或 Cursor，AI 会为您生成可运行的微信小程序零售端代码。

生成后在**微信开发者工具**里导入即可。

---

## 二、提示词全文（复制这部分）

> 以下内容整段复制，粘贴后把 `api.yourdomain.com` 改成您自己的后端域名。

```
你是一名资深全栈工程师。请用微信原生小程序（JavaScript + WXML + WXSS）帮我搭建一个「央皿陶瓷」零售端小程序。后端已就绪，所有数据通过 RESTful API 从以下地址获取：

  API BaseURL: https://api.yourdomain.com/api
  鉴权方式:    Bearer JWT
  登录接口:    POST /client/auth/wechat-login  (参数 { code })
             → 返回 { token, user }
  接口统一响应: { code: 0, data: ..., message: '' }

## 一、页面清单

1. `/pages/index/index`        首页（轮播图 + 分类快捷 + 推荐商品瀑布流）
2. `/pages/category/category`   分类页（左右分栏，左侧一级分类，右侧二级 + 商品）
3. `/pages/product/detail`      商品详情（轮播 + 规格选择 + 立即购买 / 加购物车）
4. `/pages/cart/cart`           购物车（多选 + 数量调整 + 小计 + 结算）
5. `/pages/order/confirm`       下单结算（收货地址 + 支付方式 + 备注）
6. `/pages/order/list`          订单列表（5 个 Tab：全部/待付款/待发货/已发货/已完成）
7. `/pages/order/detail`        订单详情（状态时间轴 + 商品清单 + 物流信息）
8. `/pages/user/user`           个人中心（头像、积分、优惠券、订单快捷入口、地址管理）
9. `/pages/user/address`        收货地址管理（增删改、设为默认、微信地址导入）

## 二、接口对应关系（后端已实现）

| 页面需求 | HTTP 方法 | 路径 |
|---|---|---|
| 登录 | POST | /client/auth/wechat-login |
| 首页推荐 | GET | /client/product/recommend |
| 分类列表 | GET | /client/category/tree |
| 商品列表（按分类） | GET | /client/product/list?categoryId=&page=&pageSize= |
| 商品详情 | GET | /client/product/:id |
| SKU 列表 | GET | /client/product/:id/skus |
| 加入购物车 | POST | /client/cart/add (body: { skuId, qty }) |
| 购物车列表 | GET | /client/cart |
| 修改购物车数量 | PATCH | /client/cart/:id (body: { qty }) |
| 删除购物车 | DELETE | /client/cart/:id |
| 创建订单 | POST | /client/order (body: { items, addressId, remark, paymentMethod }) |
| 订单列表 | GET | /client/order?status=&page= |
| 订单详情 | GET | /client/order/:id |
| 取消订单 | POST | /client/order/:id/cancel |
| 确认收货 | POST | /client/order/:id/confirm |
| 地址列表 | GET | /client/address |
| 新增地址 | POST | /client/address |
| 修改地址 | PUT | /client/address/:id |
| 删除地址 | DELETE | /client/address/:id |
| 用户信息 | GET | /client/user/profile |

## 三、技术要求

1. **登录流程**：
   - `app.js` 的 `onLaunch` 检查 `wx.getStorageSync('token')`
   - 无 token 时调 `wx.login()` 拿 code，POST 给后端 `/client/auth/wechat-login`
   - 拿到 token 后存 storage，之后每个请求都带 `Authorization: Bearer <token>`

2. **统一请求封装**：`utils/request.js`
   - 从 storage 读 token 自动注入 header
   - 401 清空 storage 并重新登录
   - 响应拦截：拆 `res.data.data`

3. **状态管理**：
   - 用 mobx-miniprogram 或简单的 `app.globalData` 即可
   - 购物车数量徽标要全局响应

4. **UI 风格**：
   - 主色 #1f2d3d 深蓝 + #c8a96a 暖金点缀
   - 字体：PingFang SC / 思源宋体做标题
   - 圆角 12rpx，卡片阴影轻柔
   - 底部 tabBar：首页 / 分类 / 购物车（带角标） / 我的

5. **支付**：
   - 下单接口返回 `prepayData`
   - 调 `wx.requestPayment` 发起支付
   - 支付成功跳转订单详情

6. **兼容**：
   - 基础库 ≥ 2.19
   - 真机可在 iOS / Android 正常运行
   - 横屏友好、无障碍 role 合规

## 四、目录结构参考

```
miniprogram/
├── app.js              // 启动时微信登录 → 拿 JWT
├── app.json            // 页面 + tabBar 配置
├── app.wxss            // 全局样式变量
├── utils/
│   ├── request.js      // wx.request 封装
│   ├── auth.js         // 登录 / 退出 / token 管理
│   └── format.js       // 金额、时间格式化
├── config/
│   └── index.js        // API_BASE 配置
├── components/
│   ├── product-card/   // 商品卡片
│   ├── sku-selector/   // 规格选择弹层
│   └── empty/          // 空状态
└── pages/
    ├── index/
    ├── category/
    ├── product/
    ├── cart/
    ├── order/
    └── user/
```

## 五、输出要求

1. 按页面分节输出完整代码（.js/.wxml/.wxss/.json 四件套）
2. `utils/request.js` 必须第一个输出（其他页面都依赖它）
3. `config/index.js` 让我一眼能改后端地址
4. `app.json` 必须有完整 tabBar 配置
5. 中文注释，关键业务逻辑写清楚
6. 不要用任何第三方 UI 库（避免体积超限），纯原生组件
7. 所有金额字段按 `分` 整数存储，展示时 `/ 100` 保留两位小数
8. 小程序包体积务必 < 2MB

请开始生成完整可运行的代码。
```

---

## 三、使用后的检查清单

生成代码后，请依次确认以下内容再上传微信：

1. [ ] `config/index.js` 的 `API_BASE` 已改为您的真实后端域名
2. [ ] 在微信公众平台「开发 → 开发管理 → 服务器域名」把后端域名加入 **request 合法域名**
3. [ ] 小程序管理后台打开「上传代码」权限
4. [ ] 在开发者工具打开，用真机预览测试登录
5. [ ] 后端 `server/.env` 的 `WECHAT_APPID` 和 `WECHAT_SECRET` 与小程序管理后台一致
6. [ ] 后端重启：`pm2 restart yangming-api`

## 四、若要做批发端小程序

把上面提示词做**两处修改**：

1. 把"零售"改为"批发"，强调 B 端特征：
   - 首页去掉轮播营销，改为公告 + 授信额度 + 待回款汇总
   - 商品列表展示「起批量」、「阶梯价表」而非单一零售价
   - 下单时加「授信支付」选项
   - 增加「对账单」页面（调 `GET /client/statement`）

2. 接口前缀从 `/client` 改为 `/wholesale`（后端已预留）

## 五、常见对接问题

| 问题 | 原因 | 解决 |
|---|---|---|
| `wx.login` 返回的 code 换不到 openid | AppSecret 错 | 后端 `.env` 的 `WECHAT_SECRET` 要是小程序密钥不是公众号密钥 |
| 请求报 `url not in domain list` | 没配合法域名 | 微信公众平台添加服务器域名并重启开发者工具 |
| token 过期没自动刷新 | request.js 拦截器缺失 | 在 401 分支调 `wx.login` → `/auth/wechat-login` 拿新 token |
| 真机白屏 | 本地 http 域名 | 必须 HTTPS，且证书有效 |
| 下单报 `sku not found` | SKU id 类型 | 前端 qs 传 `{ skuId: 1 }` 不要传字符串 |
| 支付调起失败 | prepayId 无效 | 后端要去微信支付下单并返回 `prepayData`（5 字段） |
