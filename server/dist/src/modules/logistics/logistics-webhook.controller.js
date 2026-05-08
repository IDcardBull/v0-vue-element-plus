"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LogisticsWebhookController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogisticsWebhookController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const kuaidi100_service_1 = require("./kuaidi100.service");
/**
 * 快递100 Webhook 推送固定应答（无论业务处理是否成功都必须返回，否则 KD100 会持续重试）
 */
const KD100_ACK = {
    result: true,
    returnCode: '200',
    message: '成功',
};
let LogisticsWebhookController = LogisticsWebhookController_1 = class LogisticsWebhookController {
    constructor(kd100) {
        this.kd100 = kd100;
        this.logger = new common_1.Logger(LogisticsWebhookController_1.name);
    }
    /**
     * 接收快递100物流轨迹变更推送
     *
     *   POST /api/kuaidi100/callback
     *   Content-Type: application/x-www-form-urlencoded
     *   body: param=<urlencoded JSON>&sign=<MD5 大写>
     *
     * 流程：
     *  1. 提取 form 字段 param / sign（NestJS 默认 body-parser 已对外层 form 做了 URL 解码，
     *     所以 body.param 就是反 URL Encode 后的 JSON 字符串，可以直接做签名 + JSON.parse）
     *  2. 用 Service 的 verifySign 重算 MD5 校验 sign，不通过直接抛 401
     *  3. JSON.parse(param) 拿到推送 payload，分发到内部业务（更新订单轨迹/状态）
     *  4. 不论业务是否抛异常，都必须给 KD100 返回固定 ACK，否则会反复重试
     */
    async handleKuaidi100Callback(body) {
        const param = (body?.param || '').toString();
        const sign = (body?.sign || '').toString();
        if (!param || !sign) {
            this.logger.warn('[Kuaidi100][Webhook] 缺少 param 或 sign');
            throw new common_1.BadRequestException('缺少 param 或 sign');
        }
        // 1) 签名校验（必须用原始未反序列化的 param 字符串）
        if (!this.kd100.verifySign(param, sign)) {
            this.logger.warn(`[Kuaidi100][Webhook] 签名不一致，疑似伪造请求；sign=${sign}`);
            throw new common_1.UnauthorizedException('快递100 推送签名校验失败');
        }
        // 2) 解析 JSON
        let payload;
        try {
            payload = JSON.parse(param);
        }
        catch (err) {
            this.logger.error(`[Kuaidi100][Webhook] param JSON 解析失败: ${err?.message}`);
            throw new common_1.BadRequestException('param 不是合法 JSON');
        }
        // 3) 派发业务处理；任何异常都吞掉只记日志，保证下面统一 ACK
        try {
            await this.dispatch(payload);
        }
        catch (err) {
            this.logger.error(`[Kuaidi100][Webhook] 业务处理异常（已吞，仍按成功 ACK）: ${err?.message}`, err?.stack);
        }
        // 4) 严格按 KD100 文档要求的应答格式返回，否则会被重试
        return KD100_ACK;
    }
    /**
     * 内部派发：把推送 payload 交给真正的业务模块（更新订单轨迹/状态、推企业微信群等）
     *
     * TODO: 接入 OrderService.applyKuaidi100Push(payload) 之后，把 lastResult.data
     *       写到订单的物流轨迹表，并按 lastResult.state / status 推动订单状态机：
     *         - "3" 已签收 -> 自动确认收货 / 标记为 completed
     *         - "4" 退签 / "7" 拒签 -> 触发退款流程
     */
    async dispatch(payload) {
        const lr = payload?.lastResult;
        const num = lr?.nu || '';
        const com = lr?.com || '';
        const state = lr?.state || lr?.status || '';
        const tracks = Array.isArray(lr?.data) ? lr.data.length : 0;
        this.logger.log(`[Kuaidi100][Webhook] 收到推送 com=${com} num=${num} state=${state} tracks=${tracks} status=${payload?.status}`);
        // 此处先打日志占位，等 OrderModule 暴露写库方法后再 wire 起来
    }
};
exports.LogisticsWebhookController = LogisticsWebhookController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('callback'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LogisticsWebhookController.prototype, "handleKuaidi100Callback", null);
exports.LogisticsWebhookController = LogisticsWebhookController = LogisticsWebhookController_1 = __decorate([
    (0, common_1.Controller)('kuaidi100'),
    __metadata("design:paramtypes", [kuaidi100_service_1.Kuaidi100Service])
], LogisticsWebhookController);
//# sourceMappingURL=logistics-webhook.controller.js.map