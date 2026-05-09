"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var WechatPayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatPayService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const axios_1 = __importDefault(require("axios"));
// wechatpay-node-v3 是主流的微信支付 V3 SDK
const wechatpay_node_v3_1 = __importDefault(require("wechatpay-node-v3"));
/**
 * 微信支付 V3 服务 + 多端微信登录
 *
 * 业务约定：
 * - 零售（B2C, retail）小程序：完整微信支付链路（JSAPI 下单 / 回调 / 发货录入 / 订阅消息）
 * - 批发（wholesale）小程序：B2B 提交采购单 → 客服线下结算，**不调起微信支付**
 *   所以批发端只需要它自己的 AppID/Secret 用于 jscode2session 登录拿 openid，
 *   不需要支付商户号；本类的支付方法不会被批发用户触发
 *
 * 不同 AppID 的 openid 互不通用；同一微信号在两个小程序里 openid 不同，
 * 在 User 表会自动产生两条记录，互不干扰。
 *
 * 环境变量（server/.env）：
 *   零售（必填，参与支付）：
 *     WX_APPID                 / WX_APPID_RETAIL    （兼容老配置 WX_APPID）
 *     WX_SECRET                / WX_SECRET_RETAIL
 *   批发（可选，仅 jscode2session/access_token 用，不接支付）：
 *     WX_APPID_WHOLESALE
 *     WX_SECRET_WHOLESALE
 *   微信支付商户号配置（仅零售用到）：
 *     WX_PAY_MCHID             商户号
 *     WX_PAY_SERIAL_NO         商户 API 证书序列号
 *     WX_PAY_PRIVATE_KEY_PATH  apiclient_key.pem 路径
 *     WX_PAY_API_V3_KEY        APIv3 密钥（32 位）
 *     WX_PAY_NOTIFY_URL        支付结果回调 URL（HTTPS 公网可达）
 *
 * 支付配置缺失时支付接口返 503，但不影响批发端登录和采购单提交。
 */
let WechatPayService = WechatPayService_1 = class WechatPayService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(WechatPayService_1.name);
        /** channel -> appid 映射 */
        this.appidMap = {
            retail: undefined,
            wholesale: undefined,
        };
        /** channel -> 小程序 secret（用于 jscode2session / cgi-bin/token） */
        this.secretMap = {
            retail: undefined,
            wholesale: undefined,
        };
        /** channel 维度的 access_token 缓存（不同 appid 的 token 互不通用） */
        this.accessTokenCacheMap = {};
        // 兼容老配置：WX_APPID/WX_SECRET 当 retail 默认
        this.appidMap.retail =
            this.config.get('WX_APPID_RETAIL') ||
                this.config.get('WX_APPID');
        this.secretMap.retail =
            this.config.get('WX_SECRET_RETAIL') ||
                this.config.get('WX_SECRET');
        this.appidMap.wholesale = this.config.get('WX_APPID_WHOLESALE');
        this.secretMap.wholesale = this.config.get('WX_SECRET_WHOLESALE');
        // 启动日志：把生效的 AppID 完整打出来（10 位 hash 仍然可以骗自己；这里展示完整
        // AppID 是公开信息，与 secret 不同）。这样登录失败时能直接拿这条对照
        // miniprogram/project.config.json 里的 appid。
        this.logger.log(`[WechatPay] 生效 AppID — retail=${this.appidMap.retail || '(未配)'}` +
            `  wholesale=${this.appidMap.wholesale || '(未配)'}`);
        if (this.appidMap.retail && !this.secretMap.retail) {
            this.logger.warn('[WechatPay] retail 端 WX_SECRET 未配置，jscode2session 必然失败');
        }
        this.mchid = this.config.get('WX_PAY_MCHID');
        this.notifyUrl = this.config.get('WX_PAY_NOTIFY_URL');
        this.apiV3Key = this.config.get('WX_PAY_API_V3_KEY');
        const serialNo = this.config.get('WX_PAY_SERIAL_NO');
        const keyPath = this.config.get('WX_PAY_PRIVATE_KEY_PATH');
        // 至少要有一个 channel 配齐 appid 才有意义
        const anyAppid = this.appidMap.retail || this.appidMap.wholesale;
        if (!anyAppid || !this.mchid || !this.notifyUrl || !this.apiV3Key || !serialNo || !keyPath) {
            this.logger.warn('[WechatPay] 未完整配置，支付相关接口将返回 503');
            return;
        }
        // 校验 notify_url 必须是合法 URL，且只有一个协议头。
        // 微信支付要求公网可达；natapp 隧道地址常被复制粘贴反复加协议头导致 400。
        if (!this.isValidNotifyUrl(this.notifyUrl)) {
            this.logger.error(`[WechatPay] WX_PAY_NOTIFY_URL 格式不合法："${this.notifyUrl}"。\n` +
                '  必须是单个完整 URL，例如：https://xxxx.natappfree.cc/api/wechat/pay-callback\n' +
                '  支付相关接口将返回 503');
            return;
        }
        // 微信支付 V3 JSAPI 要求 notify_url 必须 https，使用 http 几乎一定会被微信侧拒绝
        if (this.notifyUrl.startsWith('http://')) {
            this.logger.warn(`[WechatPay] WX_PAY_NOTIFY_URL 当前使用 http 协议："${this.notifyUrl}"。\n` +
                '  微信支付 V3 要求 notify_url 必须为 https，下单接口可能被微信侧返回 400。\n' +
                '  请改为 https://...（natapp 等隧道工具同一隧道通常同时提供 https 入口）');
        }
        try {
            const absPath = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);
            const privateKey = fs.readFileSync(absPath);
            this.privateKeyPem = privateKey;
            // SDK 的 appid 仅作为内部缺省值；下单时我们一律在 body 里显式传 channel 对应的 appid 覆盖
            this.pay = new wechatpay_node_v3_1.default({
                appid: this.appidMap.retail || this.appidMap.wholesale,
                mchid: this.mchid,
                serial_no: serialNo,
                publicKey: privateKey,
                privateKey,
            });
            this.logger.log(`[WechatPay] 初始化成功 (retail=${this.appidMap.retail ? '✓' : '✗'}, wholesale=${this.appidMap.wholesale ? '✓' : '✗'})`);
        }
        catch (e) {
            this.logger.error('[WechatPay] 商户私钥加载失败', e.stack);
        }
    }
    /**
     * 拿到指定 channel 的 appid。
     * - retail 没配 → 503（管理员需要配 WX_APPID/WX_SECRET）
     * - wholesale → 直接报"批发端不支持线上支付"，避免静默回落 retail 触发
     *   APPID_MCHID_NOT_MATCH 这种很难定位的错误
     */
    getAppidByChannel(channel) {
        if (channel === 'wholesale') {
            throw new common_1.BadRequestException('批发端订单不支持线上支付，请联系客服线下结算');
        }
        const appid = this.appidMap[channel];
        if (!appid) {
            throw new common_1.ServiceUnavailableException(`${channel} 端微信支付未配置 (缺少 WX_APPID_${channel.toUpperCase()})`);
        }
        return appid;
    }
    /** 公开：让外部模块（如 client-auth）拿 channel 对应的 appid+secret 调 jscode2session */
    getChannelCreds(channel) {
        return { appid: this.appidMap[channel], secret: this.secretMap[channel] };
    }
    /**
     * 校验 notify_url：必须能被 URL 构造器解析，且全字符串里只含一个 "://"。
     * 排除 "https://http://xxx" 这种被反复加协议头的脏值。
     */
    isValidNotifyUrl(url) {
        try {
            const u = new URL(url);
            if (u.protocol !== 'http:' && u.protocol !== 'https:')
                return false;
            // 整串只允许出现一次 "://"
            const occurrences = (url.match(/:\/\//g) || []).length;
            if (occurrences !== 1)
                return false;
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 用商户私钥对待签名串做 SHA256-RSA-PKCS1v15，结果转 Base64。
     * 这是 wx.requestPayment 的 paySign 算法，也是 V3 接口的通用签名算法。
     */
    rsaSignBase64(message) {
        if (!this.privateKeyPem) {
            throw new common_1.ServiceUnavailableException('微信支付未初始化，无法签名');
        }
        return crypto
            .createSign('RSA-SHA256')
            .update(message, 'utf8')
            .sign(this.privateKeyPem)
            .toString('base64');
    }
    /**
     * 公开：JSAPI/小程序 统一下单（V3）
     *
     * 会把 description / openid / out_trade_no / amount / notify_url 提交到
     *   POST https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi
     * 拿到 prepay_id 后，本地按官方算法对
     *   appId\n + timeStamp\n + nonceStr\n + package\n
     * 做 SHA256-RSA 签名，返回前端 wx.requestPayment 直接可用的 5 个参数。
     *
     * @param orderNo     商户订单号（out_trade_no）
     * @param amount      金额（元，小数即可，内部转分）
     * @param openid      支付用户 openid（小程序登录时拿到）
     * @param description ����品描述（≤127 字符）
     */
    async createJsApiOrder(orderNo, amount, openid, description, channel = 'retail') {
        const pay = this.ensureReady();
        if (!orderNo)
            throw new common_1.BadRequestException('orderNo 不能为空');
        if (!openid)
            throw new common_1.BadRequestException('openid 不能为空');
        // 拒绝 dev fallback 留下的假 openid（dev_xxx_local），避免去微信侧
        // 报含义模糊的 PARAM_ERROR: 无效的openid
        if (openid.startsWith('dev_')) {
            throw new common_1.BadRequestException('当前用户使用的是开发回退 openid（jscode2session 失败时生成的占位 ID），无法发起真实支付。\n' +
                '请检查：\n' +
                '  1. 微信开发者工具 → 详情 → 项目设置 中的 AppID 必须与后端 .env 的 WX_APPID 一致\n' +
                '  2. server/.env 的 WX_SECRET 是否正确\n' +
                '  3. 清除小程序登录态后重新 wx.login 拿到真实 openid');
        }
        const totalFen = Math.round(Number(amount) * 100);
        if (!Number.isFinite(totalFen) || totalFen <= 0) {
            throw new common_1.BadRequestException('支付金额必须大于 0');
        }
        const appid = this.getAppidByChannel(channel);
        // 1. 调用统一下单
        const body = {
            appid,
            mchid: this.mchid,
            description: (description || orderNo).slice(0, 127),
            out_trade_no: orderNo,
            notify_url: this.notifyUrl,
            amount: { total: totalFen, currency: 'CNY' },
            payer: { openid },
        };
        let result;
        try {
            result = await pay.transactions_jsapi(body);
        }
        catch (err) {
            this.logger.error(`[WechatPay] transactions_jsapi 失败: ${err?.message}`, err?.stack);
            throw new common_1.InternalServerErrorException(err?.message || '微信下单失败');
        }
        // wechatpay-node-v3 SDK 的特殊行为：HTTP 4xx/5xx 时不抛错，
        // 而是把 { status, errRaw, ... } 当 resolve 值返回。这里识别出来，
        // 拿微信响应 body 里真正的 code/message 抛 503/400。
        if (result && typeof result === 'object' && (result.status >= 400 || result.errRaw)) {
            // 尝试从多个可能的位置挖出真实 body
            const raw = result.errRaw || result;
            const bodyText = raw?.response?.text ||
                raw?.response?.body ||
                raw?.response?.data ||
                raw?.body ||
                raw?.data;
            let parsed = bodyText;
            if (typeof bodyText === 'string') {
                try {
                    parsed = JSON.parse(bodyText);
                }
                catch {
                    /* 非 JSON 直接保留原文 */
                }
            }
            const code = parsed?.code || raw?.code;
            const msg = parsed?.message || raw?.message || '微信下单失败';
            this.logger.error(`[WechatPay] 微信下单返回 ${result.status || raw?.status}：` +
                `code=${code} message=${msg}\n` +
                `  完整响应: ${JSON.stringify(parsed) || bodyText || JSON.stringify(result)}`);
            throw new common_1.InternalServerErrorException(`${code ? code + ': ' : ''}${msg}`);
        }
        // wechatpay-node-v3 在成功时返回 { status: 200, data: { appId, timeStamp,
        // nonceStr, package, signType, paySign } } —— SDK 已帮我们算好 wx.requestPayment
        // 全套 5 参数，直接透传即可。
        //
        // 兼容性说明：不同版本 SDK 可能直接返回 { prepay_id } 或 { data: {...prepay_id} }
        // 顶层裸 { prepay_id }，因此下方按优先级回退到本地签名。
        const sdkSigned = result?.data;
        if (sdkSigned &&
            typeof sdkSigned === 'object' &&
            sdkSigned.paySign &&
            sdkSigned.package &&
            sdkSigned.timeStamp &&
            sdkSigned.nonceStr) {
            const pkg = sdkSigned.package;
            const prepayId = pkg.startsWith('prepay_id=') ? pkg.slice('prepay_id='.length) : pkg;
            return {
                timeStamp: String(sdkSigned.timeStamp),
                nonceStr: String(sdkSigned.nonceStr),
                package: pkg,
                signType: sdkSigned.signType || 'RSA',
                paySign: sdkSigned.paySign,
                prepayId,
            };
        }
        // 兜底：拿 prepay_id 自己签
        const prepayId = result?.prepay_id || result?.data?.prepay_id;
        if (!prepayId) {
            this.logger.error('[WechatPay] 下单返回缺少 prepay_id: ' + JSON.stringify(result));
            throw new common_1.InternalServerErrorException(result?.message || result?.code || '微信下单失败');
        }
        const timeStamp = Math.floor(Date.now() / 1000).toString();
        const nonceStr = crypto.randomBytes(16).toString('hex');
        const pkg = `prepay_id=${prepayId}`;
        const message = `${appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
        const paySign = this.rsaSignBase64(message);
        return {
            timeStamp,
            nonceStr,
            package: pkg,
            signType: 'RSA',
            paySign,
            prepayId,
        };
    }
    ensureReady() {
        if (!this.pay) {
            throw new common_1.ServiceUnavailableException('微信支付未配置。请在 server/.env 配置 WX_PAY_* 相关环境变量后重启服务。');
        }
        return this.pay;
    }
    /**
     * 兼容旧调用方：内部委托 createJsApiOrder，channel 默认 retail。
     * @returns 前端 wx.requestPayment 参数（不含 prepayId）
     */
    async jsapi(params) {
        const r = await this.createJsApiOrder(params.orderNo, params.amountYuan, params.openid, params.description, params.channel || 'retail');
        const { prepayId, ...rest } = r;
        void prepayId;
        return rest;
    }
    /**
     * 获取指定 channel 的小程序 access_token。不同小程序的 token 互相独立。
     * 用途：发货信息录入、订阅消息推送等。
     */
    async getMiniProgramAccessToken(channel = 'retail') {
        const now = Date.now();
        const cached = this.accessTokenCacheMap[channel];
        if (cached && cached.expiresAt > now + 60_000)
            return cached.token;
        const { appid, secret } = this.getChannelCreds(channel);
        if (!appid || !secret) {
            throw new common_1.ServiceUnavailableException(`${channel} 端微信小程序未配置 (缺少 WX_APPID_${channel.toUpperCase()} 或 WX_SECRET_${channel.toUpperCase()})，无法调用 access_token 接口`);
        }
        const { data } = await axios_1.default.get('https://api.weixin.qq.com/cgi-bin/token', {
            params: { grant_type: 'client_credential', appid, secret },
            timeout: 5000,
        });
        if (!data?.access_token) {
            throw new common_1.InternalServerErrorException(data?.errmsg || '获取微信 access_token 失败');
        }
        this.accessTokenCacheMap[channel] = {
            token: data.access_token,
            expiresAt: now + Number(data.expires_in || 7200) * 1000,
        };
        return data.access_token;
    }
    async uploadShippingInfo(params) {
        if (!params.transactionId || !params.openid) {
            this.logger.warn(`[WechatPay] 跳过发货信息录入: transactionId/openid 缺失, order=${params.outTradeNo}`);
            return { skipped: true, reason: 'missing_transaction_or_openid' };
        }
        const accessToken = await this.getMiniProgramAccessToken(params.channel || 'retail');
        const payload = {
            order_key: { order_number_type: 2, transaction_id: params.transactionId },
            logistics_type: 1,
            delivery_mode: 1,
            shipping_list: [{ tracking_no: params.trackingNo, express_company: params.logisticsCompany }],
            upload_time: Math.floor(Date.now() / 1000),
            payer: { openid: params.openid },
        };
        const { data } = await axios_1.default.post(`https://api.weixin.qq.com/wxa/sec/order/upload_shipping_info?access_token=${accessToken}`, payload, { timeout: 8000 });
        if (data?.errcode && data.errcode !== 0) {
            this.logger.warn(`[WechatPay] 发货信息录入失败: ${JSON.stringify(data)}`);
            return { skipped: false, success: false, data };
        }
        return { skipped: false, success: true, data };
    }
    async queryLogistics(params) {
        if (!params.logisticsCompany || !params.trackingNo) {
            return {
                supported: false,
                message: '物流公司或物流单号缺失',
                company: params.logisticsCompany || '',
                trackingNo: params.trackingNo || '',
                traces: [],
            };
        }
        return {
            supported: false,
            message: '暂未接入第三方物流轨迹服务，请后续对接快递100或快递鸟',
            company: params.logisticsCompany,
            trackingNo: params.trackingNo,
            traces: [],
        };
    }
    async sendShippingSubscribeMessage(params) {
        const channel = params.channel || 'retail';
        // 模板 ID 也分端配置；若 channel 没有专属模板，回退到 WX_SUBSCRIBE_SHIPPED_TEMPLATE_ID
        const templateId = this.config.get(`WX_SUBSCRIBE_SHIPPED_TEMPLATE_ID_${channel.toUpperCase()}`) ||
            this.config.get('WX_SUBSCRIBE_SHIPPED_TEMPLATE_ID');
        if (!templateId) {
            return { skipped: true, reason: 'template_not_configured' };
        }
        if (!params.openid) {
            return { skipped: true, reason: 'missing_openid' };
        }
        const accessToken = await this.getMiniProgramAccessToken(channel);
        const payload = {
            touser: params.openid,
            template_id: templateId,
            page: `pages/order/detail?orderNo=${encodeURIComponent(params.orderNo)}`,
            data: {
                thing1: { value: '订单已发货' },
                character_string2: { value: params.orderNo.slice(0, 32) },
                thing3: { value: params.logisticsCompany.slice(0, 20) },
                character_string4: { value: params.trackingNo.slice(0, 32) },
            },
        };
        const { data } = await axios_1.default.post(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`, payload, { timeout: 8000 });
        if (data?.errcode && data.errcode !== 0) {
            this.logger.warn(`[WechatPay] 订阅消息发送失败: ${JSON.stringify(data)}`);
            return { skipped: false, success: false, data };
        }
        return { skipped: false, success: true, data };
    }
    /**
     * 校验并解密支付回调（不验签，仅老接口兼容）
     * @deprecated 请改用 verifyAndDecryptNotify
     */
    decryptNotify(headers, rawBody) {
        void headers;
        return this.decryptResource(rawBody);
    }
    /** 从微信侧拉平台证书（V3 SDK 内部已经解密 + 缓存），失败抛 503 */
    async loadPlatformCerts() {
        const now = Date.now();
        if (this.platformCertCache &&
            this.platformCertCache.expiresAt > now &&
            this.platformCertCache.map.size > 0) {
            return this.platformCertCache.map;
        }
        const pay = this.ensureReady();
        let certs;
        try {
            certs = await pay.get_certificates(this.apiV3Key);
        }
        catch (err) {
            this.logger.error(`[WechatPay] 获取平台证书失败: ${err?.message}`, err?.stack);
            throw new common_1.ServiceUnavailableException('微信平台证书加载失败');
        }
        // 不同 SDK 版本返回结构略有差异：可能是 { data: [{ serial_no, certificate }] }
        // 也可能直接是数组；统一兼容
        const list = Array.isArray(certs)
            ? certs
            : Array.isArray(certs?.data)
                ? certs.data
                : [];
        const map = new Map();
        for (const c of list) {
            const serial = c.serial_no || c.serialNo;
            const pem = c.certificate ||
                c.encrypt_certificate?.certificate ||
                c.publicKey ||
                c.cert;
            if (serial && pem)
                map.set(String(serial), String(pem));
        }
        if (map.size === 0) {
            throw new common_1.ServiceUnavailableException('平台证书列表为空');
        }
        this.platformCertCache = { map, expiresAt: now + 10 * 60 * 1000 };
        return map;
    }
    /**
     * 完整验签 + 解密微信支付回调（推荐）
     *
     * 1) 从 headers 取 Wechatpay-Signature / Timestamp / Nonce / Serial
     * 2) 用 serial 找到对应平台证书的公钥
     * 3) 重组待签名串 timestamp\n + nonce\n + rawBody\n，对 signature 做 RSA-SHA256 验签
     * 4) 验签通过后用 APIv3Key 对 resource.ciphertext 做 AES-256-GCM 解密
     *
     * @throws UnauthorizedException 验签失败
     * @throws BadRequestException 头部缺失 / body 非法 / resource 缺失
     */
    async verifyAndDecryptNotify(headers, rawBody) {
        this.ensureReady();
        if (!rawBody)
            throw new common_1.BadRequestException('回调 rawBody 为空');
        const get = (k) => {
            const v = headers[k] ?? headers[k.toLowerCase()];
            return Array.isArray(v) ? v[0] : v;
        };
        const timestamp = get('Wechatpay-Timestamp');
        const nonce = get('Wechatpay-Nonce');
        const signature = get('Wechatpay-Signature');
        const serial = get('Wechatpay-Serial');
        if (!timestamp || !nonce || !signature || !serial) {
            throw new common_1.BadRequestException('回调缺少 Wechatpay-Timestamp / Nonce / Signature / Serial 头');
        }
        // 防重放：微信要求 timestamp 与服务器时间偏差 ≤ 5 分钟
        const ts = Number(timestamp);
        if (Number.isFinite(ts) && Math.abs(Date.now() / 1000 - ts) > 300) {
            throw new common_1.UnauthorizedException('回调时间戳偏差过大，疑似重放攻击');
        }
        // 1. 验��
        const certs = await this.loadPlatformCerts();
        const certPem = certs.get(String(serial));
        if (!certPem) {
            // 对应序列号的证书不在缓存里 -> 强制刷新一次再重试
            this.platformCertCache = undefined;
            const refreshed = await this.loadPlatformCerts();
            const retry = refreshed.get(String(serial));
            if (!retry) {
                throw new common_1.UnauthorizedException(`未找到 Wechatpay-Serial=${serial} 对应的平台证书`);
            }
        }
        const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
        const ok = crypto
            .createVerify('RSA-SHA256')
            .update(message, 'utf8')
            .verify(certs.get(String(serial)), signature, 'base64');
        if (!ok) {
            throw new common_1.UnauthorizedException('微信回调签名校验失败');
        }
        // 2. 解密
        return this.decryptResource(rawBody);
    }
    /** 公共：从 envelope.resource.ciphertext 还原明文 JSON */
    decryptResource(rawBody) {
        const pay = this.ensureReady();
        let envelope;
        try {
            envelope = JSON.parse(rawBody);
        }
        catch {
            throw new common_1.BadRequestException('回调 body 不是合法 JSON');
        }
        const { resource } = envelope || {};
        if (!resource?.ciphertext)
            throw new common_1.BadRequestException('回调体缺少 resource.ciphertext');
        const decrypted = pay.decipher_gcm(resource.ciphertext, resource.associated_data, resource.nonce, this.apiV3Key);
        const data = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
        return {
            out_trade_no: data.out_trade_no,
            transaction_id: data.transaction_id,
            trade_state: data.trade_state,
            amount: data.amount,
            raw: data,
        };
    }
};
exports.WechatPayService = WechatPayService;
exports.WechatPayService = WechatPayService = WechatPayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], WechatPayService);
//# sourceMappingURL=wechat-pay.service.js.map