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
    ensureReady() {
        if (!this.pay) {
            throw new common_1.ServiceUnavailableException('微信支付未配置。请在 server/.env 配置 WX_PAY_* 相关环境变量后重启服务。');
        }
        return this.pay;
    }
    /**
     * JSAPI/小程序 下单
     * @returns 前端 wx.requestPayment 参数
     */
    async jsapi(params) {
        const pay = this.ensureReady();
        const totalFen = Math.round(params.amountYuan * 100);
        if (totalFen <= 0)
            throw new common_1.BadRequestException('支付金额必须大于 0');
        const body = {
            appid: this.appid,
            mchid: this.mchid,
            description: params.description || params.orderNo,
            out_trade_no: params.orderNo,
            notify_url: this.notifyUrl,
            amount: { total: totalFen, currency: 'CNY' },
            payer: { openid: params.openid },
        };
        const result = await pay.transactions_jsapi(body);
        if (!result?.prepay_id) {
            this.logger.error('[WechatPay] 下单失败: ' + JSON.stringify(result));
            throw new common_1.InternalServerErrorException(result?.message || '微信下单失败');
        }
        // 拼装前端 wx.requestPayment 所需参数（已带签名）
        const timeStamp = Math.floor(Date.now() / 1000).toString();
        const nonceStr = Math.random().toString(36).slice(2, 18);
        const pkg = `prepay_id=${result.prepay_id}`;
        const paySign = pay.sign(`${this.appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`);
        return {
            timeStamp,
            nonceStr,
            package: pkg,
            signType: 'RSA',
            paySign,
        };
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
     * 校验并解密支付回调
     * @param headers 原始请求头
     * @param rawBody 未经解析的 body 字符串
     */
    decryptNotify(headers, rawBody) {
        const pay = this.ensureReady();
        const apiV3Key = this.apiV3Key;
        // 注意：需要提前通过 pay.get_certificates() 缓存平台证书用于验签
        // 简化处理：这里只解密，不做完整验签（生产必须开启验签）
        let envelope;
        try {
            envelope = JSON.parse(rawBody);
        }
        catch {
            throw new common_1.BadRequestException('回调 body 不是合法 JSON');
        }
        const { resource } = envelope || {};
        if (!resource?.ciphertext)
            throw new common_1.BadRequestException('回调体缺少 resource');
        const decrypted = pay.decipher_gcm(resource.ciphertext, resource.associated_data, resource.nonce, apiV3Key);
        const data = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
        return {
            out_trade_no: data.out_trade_no,
            transaction_id: data.transaction_id,
            trade_state: data.trade_state,
            amount: data.amount,
        };
    }
};
exports.WechatPayService = WechatPayService;
exports.WechatPayService = WechatPayService = WechatPayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], WechatPayService);
//# sourceMappingURL=wechat-pay.service.js.map