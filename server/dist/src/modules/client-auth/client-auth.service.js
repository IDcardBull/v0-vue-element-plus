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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientAuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
const prisma_service_1 = require("../../common/prisma.service");
const wechat_pay_service_1 = require("../client/wechat-pay.service");
let ClientAuthService = class ClientAuthService {
    constructor(prisma, jwt, config, wxpay) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.wxpay = wxpay;
    }
    /**
     * 微信小程序登录：前端 wx.login 得到 code，传给后端换 openid
     *
     * channel 决定了用哪个小程序的 AppID+Secret 调 jscode2session，
     * 同一微信号在两个小程序里 openid 不同 → 自动产生两条 User 记录，互不干扰。
     * 之后这个用户的所有支付都用 user.appChannel 对应的 AppID。
     */
    async miniLogin(code, channel = 'retail') {
        if (!code)
            throw new common_1.BadRequestException('code 不能为空');
        const { appid, secret } = this.wxpay.getChannelCreds(channel);
        const devFallbackEnabled = this.config.get('WX_LOGIN_DEV_FALLBACK') === 'true';
        if (!appid || !secret) {
            if (devFallbackEnabled)
                return this.devMiniLogin('missing-config', channel);
            // 把缺哪个变量、当前生效什么都暴露给前端，避免运营只看到"401 Unauthorized"
            const missing = [];
            if (!appid)
                missing.push(`WX_APPID_${channel.toUpperCase()}`);
            if (!secret)
                missing.push(`WX_SECRET_${channel.toUpperCase()}`);
            throw new common_1.UnauthorizedException(`${channel === 'wholesale' ? '批发' : '零售'}端微信小程序未配置：` +
                `\n  → 服务端 .env 缺少 ${missing.join(' 和 ')}` +
                `\n  → 当前生效：appid=${appid || '(空)'} secret=${secret ? '已配置' : '(空)'}` +
                `\n  → 配齐后必须重启后端进程才会生效`);
        }
        try {
            const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
            const { data } = await axios_1.default.get(url, { timeout: 5000 });
            if (data.errcode) {
                if (devFallbackEnabled)
                    return this.devMiniLogin(`wechat-${data.errcode}`, channel);
                // 把后端实际在用的 appid 暴露出来，前端 toast 直接告诉用户两边对照
                // 40029 invalid code = 客户端 AppID 与后端 jscode2session 用的 AppID 不一致
                // 40125 invalid appsecret = AppSecret 配错
                // 45011 = 同一 code 被换了多次（频率限制）
                const hint = data.errcode === 40029
                    ? `\n  → 后端用的 AppID=${appid} 与小程序客户端 AppID 不匹配，请核对 server/.env 的 WX_APPID${channel === 'wholesale' ? '_WHOLESALE' : '_RETAIL'}（或 WX_APPID）和 miniprogram/project.config.json 里的 appid 是否一致`
                    : data.errcode === 40125
                        ? `\n  → AppSecret 配错，请去微信公众平台 → 开发 → 开发设置 重置 secret 后更新 server/.env 的 WX_SECRET`
                        : data.errcode === 45011
                            ? `\n  → 频率超限或 code 被复用，1 分钟后重试；前端确保 wx.login 拿到的 code 只调一次后端`
                            : '';
                throw new common_1.UnauthorizedException(`微信登录失败：${data.errmsg}${hint}`);
            }
            const { openid, unionid } = data;
            return this.loginByOpenid(openid, unionid || null, channel);
        }
        catch (error) {
            if (error instanceof common_1.UnauthorizedException || error instanceof common_1.BadRequestException)
                throw error;
            if (devFallbackEnabled)
                return this.devMiniLogin('request-failed', channel);
            throw new common_1.UnauthorizedException(error?.message || '微信登录失败');
        }
    }
    async loginByOpenid(openid, unionid, channel) {
        let user = await this.prisma.user.findUnique({ where: { openid } });
        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    openid,
                    unionid: unionid || null,
                    // 批发小程序用户默认 dealer 角色（待审核），零售默认 retail
                    role: channel === 'wholesale' ? 'dealer' : 'retail',
                    appChannel: channel,
                },
            });
        }
        else {
            // 已存在用户：更新最后活跃时间，并校正 appChannel（万一历史数据缺失）
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    lastActiveAt: new Date(),
                    ...(user.appChannel !== channel ? { appChannel: channel } : {}),
                },
            });
        }
        const token = await this.signClientToken(user);
        return { token, user: this.sanitize(user) };
    }
    /** 开发回退：没有真实 AppID/Secret 时给一个固定 openid 跑通登录链路 */
    async devMiniLogin(reason, channel) {
        const fakeAppid = this.wxpay.getChannelCreds(channel).appid || channel;
        const openid = `dev_${fakeAppid}_local`;
        const result = await this.loginByOpenid(openid, null, channel);
        return { ...result, dev: true, reason };
    }
    signClientToken(user) {
        return this.jwt.signAsync({
            sub: user.id,
            username: user.phone || user.openid,
            userType: 'client',
            role: user.role,
            appChannel: user.appChannel,
        });
    }
    /**
     * 手机号+验证码登录（零售、批发 H5 通用），演示版跳过短信校验
     */
    async phoneLogin(phone, code, channel = 'retail') {
        if (!phone || !code)
            throw new common_1.BadRequestException('手机号和验证码必填');
        // TODO: 生产环境请接入腾讯云短信 SDK 校验验证码
        if (code !== '123456')
            throw new common_1.UnauthorizedException('验证码错误');
        let user = await this.prisma.user.findUnique({ where: { phone } });
        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    phone,
                    role: channel === 'wholesale' ? 'dealer' : 'retail',
                    appChannel: channel,
                },
            });
        }
        else {
            await this.prisma.user.update({
                where: { id: user.id },
                data: { lastActiveAt: new Date() },
            });
        }
        const token = await this.jwt.signAsync({
            sub: user.id,
            username: user.phone,
            userType: 'client',
            role: user.role,
            appChannel: user.appChannel,
        });
        return { token, user: this.sanitize(user) };
    }
    /** 绑定手机号 */
    async bindPhone(userId, phone) {
        await this.prisma.user.update({ where: { id: userId }, data: { phone } });
        return { ok: true };
    }
    sanitize(u) {
        return {
            id: u.id,
            nickname: u.nickname,
            avatar: u.avatar,
            phone: u.phone,
            role: u.role,
            levelId: u.levelId,
            points: u.points,
            appChannel: u.appChannel,
        };
    }
};
exports.ClientAuthService = ClientAuthService;
exports.ClientAuthService = ClientAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        wechat_pay_service_1.WechatPayService])
], ClientAuthService);
//# sourceMappingURL=client-auth.service.js.map