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
var ClientPayController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientPayController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const prisma_service_1 = require("../../common/prisma.service");
const order_service_1 = require("../order/order.service");
const wechat_pay_service_1 = require("./wechat-pay.service");
let ClientPayController = ClientPayController_1 = class ClientPayController {
    constructor(prisma, orderSvc, wxpay) {
        this.prisma = prisma;
        this.orderSvc = orderSvc;
        this.wxpay = wxpay;
        this.logger = new common_1.Logger(ClientPayController_1.name);
    }
    /**
     * 对指定订单发起微信支付
     * 前端拿返回的 { timeStamp, nonceStr, package, signType, paySign } 直接喂给 wx.requestPayment
     */
    async pay(user, id) {
        if (user.userType !== 'client')
            throw new common_1.ForbiddenException('仅小程序用户可支付');
        const order = await this.orderSvc.findById(id);
        if (order.userId !== user.sub)
            throw new common_1.NotFoundException('订单不存在');
        if (order.status !== 'pending_pay')
            throw new common_1.BadRequestException('订单当前状态不可支付');
        const u = await this.prisma.user.findUnique({ where: { id: user.sub } });
        if (!u?.openid)
            throw new common_1.BadRequestException('用户缺少 openid，需先通过微信登录');
        // 用户登录时记录的 appChannel 决定下单时给微信传哪个 AppID。
        // 注意：openid 是按 AppID 隔离的，零售小程序 openid 不能用批发 AppID 下单（反之亦然），
        // 否则会触发 APPID_MCHID_NOT_MATCH 或 OPENID_NOT_BELONG_TO_APPID。
        const channel = (u.appChannel === 'wholesale' ? 'wholesale' : 'retail');
        return this.wxpay.jsapi({
            openid: u.openid,
            orderNo: order.orderNo,
            amountYuan: Number(order.totalAmount),
            description: `订单 ${order.orderNo}`,
            channel,
        });
    }
    /**
     * 微信支付结果回调
     * - 无需登录（微信服务器直接调用），使用 @Public
     * - 使用 @Res 绕过 ResponseInterceptor，直接按微信规范返回
     * - 需要原始 body（rawBody）用于验签/解密
     */
    async notify(req, res) {
        const rawBody = req.rawBody?.toString('utf8') || '';
        try {
            const result = this.wxpay.decryptNotify(req.headers, rawBody);
            this.logger.log(`[WxPay] 回调 ${result.out_trade_no} → ${result.trade_state}`);
            if (result.trade_state === 'SUCCESS') {
                // 订单号 → id
                const order = await this.prisma.order.findUnique({
                    where: { orderNo: result.out_trade_no },
                });
                if (order && order.status === 'pending_pay') {
                    await this.orderSvc.markPaid(order.id, result.transaction_id);
                }
            }
            // 微信要求 200 + 固定 JSON
            res.status(200).json({ code: 'SUCCESS', message: '成功' });
        }
        catch (e) {
            this.logger.error('[WxPay] 回调处理失败', e.stack);
            res.status(500).json({ code: 'FAIL', message: e.message });
        }
    }
};
exports.ClientPayController = ClientPayController;
__decorate([
    (0, common_1.Post)('orders/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], ClientPayController.prototype, "pay", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('notify'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ClientPayController.prototype, "notify", null);
exports.ClientPayController = ClientPayController = ClientPayController_1 = __decorate([
    (0, common_1.Controller)('client/pay'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        order_service_1.OrderService,
        wechat_pay_service_1.WechatPayService])
], ClientPayController);
//# sourceMappingURL=client-pay.controller.js.map