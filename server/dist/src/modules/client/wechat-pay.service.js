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
 * 微信支付 V3 服务
 *
 * 依赖的环境变量（在 server/.env 配置）：
 *   WX_APPID                 小程序 AppID
 *   WX_PAY_MCHID             商户号
 *   WX_PAY_SERIAL_NO         商户 API 证书序列号
 *   WX_PAY_PRIVATE_KEY_PATH  apiclient_key.pem 绝对路径
 *   WX_PAY_API_V3_KEY        APIv3 密钥（32 位）
 *   WX_PAY_NOTIFY_URL        支付结果回调 URL（公网可访问，HTTPS）
 *
 * 任一项缺失时，所有方法都会抛出 503，方便本地没有支付资质时调试其他功能。
 */
let WechatPayService = WechatPayService_1 = class WechatPayService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(WechatPayService_1.name);
        this.appid = this.config.get('WX_APPID');
        this.mchid = this.config.get('WX_PAY_MCHID');
        this.notifyUrl = this.config.get('WX_PAY_NOTIFY_URL');
        this.apiV3Key = this.config.get('WX_PAY_API_V3_KEY');
        const serialNo = this.config.get('WX_PAY_SERIAL_NO');
        const keyPath = this.config.get('WX_PAY_PRIVATE_KEY_PATH');
        if (!this.appid ||
            !this.mchid ||
            !this.notifyUrl ||
            !this.apiV3Key ||
            !serialNo ||
            !keyPath) {
            this.logger.warn('[WechatPay] 未完整配置，支付相关接口将返回 503');
            return;
        }
        try {
            const absPath = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);
            const privateKey = fs.readFileSync(absPath);
            this.privateKeyPem = privateKey;
            this.pay = new wechatpay_node_v3_1.default({
                appid: this.appid,
                mchid: this.mchid,
                serial_no: serialNo,
                publicKey: privateKey, // V3 SDK 里字段名，用的是商户私钥
                privateKey,
            });
            this.logger.log('[WechatPay] 初始化成功');
        }
        catch (e) {
            this.logger.error('[WechatPay] 商户私钥加载失败', e.stack);
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
     * @param description 商品描述（≤127 字符）
     */
    async createJsApiOrder(orderNo, amount, openid, description) {
        const pay = this.ensureReady();
        if (!orderNo)
            throw new common_1.BadRequestException('orderNo 不能为空');
        if (!openid)
            throw new common_1.BadRequestException('openid 不能为空');
        const totalFen = Math.round(Number(amount) * 100);
        if (!Number.isFinite(totalFen) || totalFen <= 0) {
            throw new common_1.BadRequestException('支付金额必须大于 0');
        }
        // 1. 调用统一下单
        const body = {
            appid: this.appid,
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
        if (!result?.prepay_id) {
            this.logger.error('[WechatPay] 下单返回缺少 prepay_id: ' + JSON.stringify(result));
            throw new common_1.InternalServerErrorException(result?.message || result?.code || '微信下单失败');
        }
        // 2. 本地按官方算法生成 wx.requestPayment 5 个参数
        const timeStamp = Math.floor(Date.now() / 1000).toString();
        const nonceStr = crypto.randomBytes(16).toString('hex');
        const pkg = `prepay_id=${result.prepay_id}`;
        const message = `${this.appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
        const paySign = this.rsaSignBase64(message);
        return {
            timeStamp,
            nonceStr,
            package: pkg,
            signType: 'RSA',
            paySign,
            prepayId: result.prepay_id,
        };
    }
    ensureReady() {
        if (!this.pay) {
            throw new common_1.ServiceUnavailableException('微信支付未配置。请在 server/.env 配置 WX_PAY_* 相关环境变量后重启服务。');
        }
        return this.pay;
    }
    /**
     * 兼容旧调用方：内部委托 createJsApiOrder。
     * @returns 前端 wx.requestPayment 参数（不含 prepayId）
     */
    async jsapi(params) {
        const r = await this.createJsApiOrder(params.orderNo, params.amountYuan, params.openid, params.description);
        const { prepayId, ...rest } = r;
        void prepayId;
        return rest;
    }
    async getMiniProgramAccessToken() {
        const now = Date.now();
        if (this.accessTokenCache && this.accessTokenCache.expiresAt > now + 60_000) {
            return this.accessTokenCache.token;
        }
        const appid = this.config.get('WX_APPID');
        const secret = this.config.get('WX_SECRET');
        if (!appid || !secret) {
            throw new common_1.ServiceUnavailableException('微信小程序未配置，无法调用发货信息录入接口');
        }
        const { data } = await axios_1.default.get('https://api.weixin.qq.com/cgi-bin/token', {
            params: { grant_type: 'client_credential', appid, secret },
            timeout: 5000,
        });
        if (!data?.access_token) {
            throw new common_1.InternalServerErrorException(data?.errmsg || '获取微信 access_token 失败');
        }
        this.accessTokenCache = {
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
        const accessToken = await this.getMiniProgramAccessToken();
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
        const templateId = this.config.get('WX_SUBSCRIBE_SHIPPED_TEMPLATE_ID');
        if (!templateId) {
            return { skipped: true, reason: 'template_not_configured' };
        }
        if (!params.openid) {
            return { skipped: true, reason: 'missing_openid' };
        }
        const accessToken = await this.getMiniProgramAccessToken();
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
        // 1. 验签
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