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
     * 主动同步支付状态（前端在 wx.requestPayment 成功回调里调用）
     *
     * 业务背景：微信异步 notify 在以下场景常常推不到 / 推迟到达：
     *   - 开发环境 notify_url 不是公网 https
     *   - notify_url 配置错、平台证书过期
     *   - 公网偶发抖动（通常重试，但用户已经站在结果页等结果）
     *
     * 解决：用户付完款一定会回到小程序，前端调一次本接口，后端用商户证书
     * 主动 GET https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/{orderNo}
     * 拿真实 trade_state；为 SUCCESS 就直接 markPaid。这样**不依赖** notify
     * 也能让用户立刻看到"已支付"。
     *
     * 幂等：内部走 markPaid（仅 status=pending_pay 时才更新），
     * 用户多次刷新都不会重复处理。
     */
    async sync(user, id) {
        if (user.userType !== 'client')
            throw new common_1.ForbiddenException('仅小程序用户可同步支付');
        const order = await this.orderSvc.findById(id);
        if (order.userId !== user.sub)
            throw new common_1.NotFoundException('订单不存在');
        // 已经是支付后状态：直接返回，避免去微信查询白做一次
        if (order.status !== 'pending_pay') {
            return {
                status: order.status,
                paid: order.status !== 'pending_pay' && order.status !== 'cancelled',
                tradeState: 'SUCCESS',
                message: '订单已处于支付后状态',
            };
        }
        const result = await this.wxpay.queryOrderByOutTradeNo(order.orderNo);
        this.logger.log(`[WxPay/Sync] order=${order.orderNo} trade_state=${result.trade_state} tx=${result.transaction_id || ''}`);
        if (result.trade_state === 'SUCCESS') {
            // 二次校验金额（防止极端伪造）
            if (result.amount?.total != null) {
                const expectedFen = Math.round(Number(order.totalAmount) * 100);
                if (Number(result.amount.total) !== expectedFen) {
                    this.logger.error(`[WxPay/Sync] 金额不一致 order=${order.orderNo} expected=${expectedFen} actual=${result.amount.total}`);
                    throw new common_1.BadRequestException('支付金额与订单不一致，请联系客服');
                }
            }
            try {
                await this.orderSvc.markPaid(order.id, result.transaction_id);
            }
            catch (err) {
                // 与 notify 并发触发的幂等冲突：忽略
                this.logger.warn(`[WxPay/Sync] markPaid 幂等冲突: ${err?.message || err}`);
            }
            return {
                status: 'pending_ship',
                paid: true,
                tradeState: result.trade_state,
                transactionId: result.transaction_id,
                message: '支付成功',
            };
        }
        // 中间状态：USERPAYING（需轮询）/ NOTPAY（用户未付）/ CLOSED（订单关闭）/ PAYERROR
        return {
            status: order.status,
            paid: false,
            tradeState: result.trade_state,
            tradeStateDesc: result.trade_state_desc,
            message: result.trade_state === 'USERPAYING'
                ? '用户支付中，请稍候再试'
                : result.trade_state === 'NOTPAY'
                    ? '用户尚未完成支付'
                    : result.trade_state_desc || '支付未成功',
        };
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
    (0, common_1.Post)('orders/:id/sync'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], ClientPayController.prototype, "sync", null);
exports.ClientPayController = ClientPayController = ClientPayController_1 = __decorate([
    (0, common_1.Controller)('client/pay'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        order_service_1.OrderService,
        wechat_pay_service_1.WechatPayService])
], ClientPayController);
//# sourceMappingURL=client-pay.controller.js.map