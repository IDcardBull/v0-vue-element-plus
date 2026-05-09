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
var WorkWxService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkWxService = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
/**
 * 企业微信群机器人通知（Webhook 模式，零鉴权）
 *
 * 用法：
 *   1. 在企业微信任意群里添加群机器人，复制 webhook URL；
 *   2. 把 URL 配到 server/.env 的 WORK_WX_BOT_WEBHOOK；
 *   3. 业务侧只关心 sendMarkdown / sendText / sendOrderPaid 等高层方法。
 *
 * 设计原则：
 *   - 通知失败永远不能阻塞主业务流（catch 后只 logger.warn）
 *   - 单次失败不要重试 / 不要塞队列：群机器人允许丢消息，但一旦发布则保证不阻塞订单流程
 *   - 未配置时默认静默跳过；一行 warn 提示就够了
 *
 * 文档：https://developer.work.weixin.qq.com/document/path/91770
 */
let WorkWxService = WorkWxService_1 = class WorkWxService {
    constructor(http, config) {
        this.http = http;
        this.config = config;
        this.logger = new common_1.Logger(WorkWxService_1.name);
        const webhook = this.getWebhook();
        if (webhook) {
            // 不打全 URL（key 是敏感的），只打 host + path 末尾
            const masked = webhook.replace(/key=([^&]+)/, (_m, key) => {
                const k = String(key);
                return `key=${k.slice(0, 4)}***${k.slice(-4)}`;
            });
            this.logger.log(`[WorkWx] 群机器人通知已启用：${masked}`);
        }
    }
    /** 是否已配置可用 webhook */
    isEnabled() {
        return !!this.getWebhook();
    }
    getWebhook() {
        return (this.config.get('WORK_WX_BOT_WEBHOOK') || '').trim();
    }
    // ============ 底层发送 ============
    async post(payload) {
        const url = this.getWebhook();
        if (!url)
            return; // 静默跳过
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.http.post(url, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000,
            }));
            // 企微返回 { errcode: 0, errmsg: 'ok' } 才算真成功
            if (data?.errcode && data.errcode !== 0) {
                this.logger.warn(`[WorkWx] 推送失败 errcode=${data.errcode} errmsg=${data.errmsg}`);
            }
        }
        catch (err) {
            this.logger.warn(`[WorkWx] 推送异常: ${err?.message || err}`);
        }
    }
    /** 截断 markdown，避免超过 4096 字节限制 */
    trim(content) {
        const buf = Buffer.from(content, 'utf8');
        if (buf.byteLength <= WorkWxService_1.MAX_BYTES)
            return content;
        return buf.slice(0, WorkWxService_1.MAX_BYTES).toString('utf8') + '\n...(已截断)';
    }
    // ============ 高层方法 ============
    /** 纯文本通知（@everyone 用 @all） */
    async sendText(content, mentionAll = false) {
        await this.post({
            msgtype: 'text',
            text: {
                content: this.trim(content),
                mentioned_list: mentionAll ? ['@all'] : undefined,
            },
        });
    }
    /** Markdown 通知（推荐，支持颜色 + 链接 + 列表） */
    async sendMarkdown(content) {
        await this.post({
            msgtype: 'markdown',
            markdown: { content: this.trim(content) },
        });
    }
    /**
     * 新订单创建通知（用户刚下单，尚未付款）
     * 与 sendOrderPaid 区分：
     *   - 标题用 <font color="comment"> 弱提示，不抢"已付款"卡片的眼神
     *   - 金额仍 warning 黄色，方便运营快速扫到
     *   - 不发授信单（授信单走 sendCreditOrderCreated 模板）
     */
    async sendOrderCreated(order) {
        if (!this.isEnabled())
            return;
        const channelLabel = order.channel === 'wholesale' ? '批发' : '零售';
        const itemsLines = order.items
            .slice(0, 8)
            .map((it) => `> ${it.productName} × ${it.qty}`)
            .join('\n');
        const moreLine = order.items.length > 8 ? `> ……另有 ${order.items.length - 8} 项` : '';
        const md = [
            `**<font color="comment">新订单 / ${channelLabel}（待付款）</font>**`,
            `订单号：${order.orderNo}`,
            `金额：<font color="warning">¥${Number(order.totalAmount).toFixed(2)}</font>`,
            `支付方式：${order.payMethod === 'wechat' ? '微信支付（待支付）' : order.payMethod || '-'}`,
            order.receiver
                ? `收货人：${order.receiver}${order.receiverPhone ? ' · ' + this.maskPhone(order.receiverPhone) : ''}`
                : '',
            order.receiverAddress ? `地址：${order.receiverAddress}` : '',
            '',
            '**商品明细：**',
            itemsLines,
            moreLine,
        ]
            .filter(Boolean)
            .join('\n');
        await this.sendMarkdown(md);
    }
    /**
     * 订单付款成功通知。
     * 给运营群发一条结构化 markdown，关键字加色：
     *   - 金额绿色，提醒尽快备货
     */
    async sendOrderPaid(order) {
        if (!this.isEnabled())
            return;
        const channelLabel = order.channel === 'wholesale' ? '批发' : '零售';
        const itemsLines = order.items
            .slice(0, 8)
            .map((it) => `> ${it.productName} × ${it.qty}`)
            .join('\n');
        const moreLine = order.items.length > 8 ? `> ……另有 ${order.items.length - 8} 项` : '';
        const md = [
            `**支付成功 / ${channelLabel}订单**`,
            `订单号：<font color="info">${order.orderNo}</font>`,
            `金额：<font color="warning">¥${Number(order.totalAmount).toFixed(2)}</font>`,
            `支付方式：${order.payMethod === 'wechat' ? '微信支付' : order.payMethod || '-'}`,
            order.receiver
                ? `收货人：${order.receiver}${order.receiverPhone ? ' · ' + this.maskPhone(order.receiverPhone) : ''}`
                : '',
            order.receiverAddress ? `地址：${order.receiverAddress}` : '',
            '',
            '**商品明细：**',
            itemsLines,
            moreLine,
        ]
            .filter(Boolean)
            .join('\n');
        await this.sendMarkdown(md);
    }
    /**
     * 分销商授信下单通知（往往金额较大，加 @all 提醒）
     * 单独走一条不同模板，让运营/财务一眼分辨"已付现金 vs 占用授信额度"
     */
    async sendCreditOrderCreated(order) {
        if (!this.isEnabled())
            return;
        const used = Number(order.creditUsed);
        const limit = Number(order.creditLimit);
        const remain = Math.max(0, limit - used);
        const usagePct = limit > 0 ? Math.round((used / limit) * 100) : 0;
        // 用色提示授信使用率：>=90% 红色，>=70% 橙色，否则绿色
        const usageColor = usagePct >= 90 ? 'warning' : usagePct >= 70 ? 'comment' : 'info';
        const itemsLines = order.items
            .slice(0, 8)
            .map((it) => `> ${it.productName} × ${it.qty}`)
            .join('\n');
        const md = [
            `**分销商授信下单**`,
            `分销商：<font color="info">${order.distributorName || '-'}</font>`,
            `订单号：${order.orderNo}`,
            `本单金额：<font color="warning">¥${Number(order.totalAmount).toFixed(2)}</font>`,
            `授信使用：<font color="${usageColor}">¥${used.toFixed(2)} / ¥${limit.toFixed(2)} (${usagePct}%)</font>`,
            `剩余额度：¥${remain.toFixed(2)}`,
            '',
            '**商品明细：**',
            itemsLines,
            order.items.length > 8 ? `> ……另有 ${order.items.length - 8} 项` : '',
        ]
            .filter(Boolean)
            .join('\n');
        await this.sendMarkdown(md);
    }
    /**
     * 物流轨迹推送通知（签收 / 异常）
     * 仅对"签收 / 退签 / 拒签"等终态触发，避免在途节点刷屏
     */
    async sendLogisticsTerminal(params) {
        if (!this.isEnabled())
            return;
        const stateLabel = {
            signed: '已签收',
            rejected: '已拒签',
            returned: '已退签',
            problem: '物流异常',
        };
        const color = params.state === 'signed' ? 'info' : 'warning';
        const md = [
            `**物流状态变更：<font color="${color}">${stateLabel[params.state]}</font>**`,
            `订单：${params.orderNo}`,
            `快递：${params.company} / ${params.trackingNo}`,
            params.lastContext ? `最新轨迹：${params.lastContext}` : '',
        ]
            .filter(Boolean)
            .join('\n');
        await this.sendMarkdown(md);
    }
    /** 手机号中间四位脱敏 */
    maskPhone(phone) {
        if (!phone || phone.length < 7)
            return phone;
        return phone.slice(0, 3) + '****' + phone.slice(-4);
    }
};
exports.WorkWxService = WorkWxService;
/** 群机器人允许的最大字节数（实际限制 4096，留出 buffer） */
WorkWxService.MAX_BYTES = 3500;
exports.WorkWxService = WorkWxService = WorkWxService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], WorkWxService);
//# sourceMappingURL=work-wx.service.js.map