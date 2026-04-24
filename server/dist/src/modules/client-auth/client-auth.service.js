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
let ClientAuthService = class ClientAuthService {
    constructor(prisma, jwt, config) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
    }
    /**
     * 微信小程序登录：前端 wx.login 得到 code，传给后端换 openid
     * 首次登录自动建档 users 表（role=retail）
     */
    async miniLogin(code) {
        if (!code)
            throw new common_1.BadRequestException('code 不能为空');
        const appid = this.config.get('WX_APPID');
        const secret = this.config.get('WX_SECRET');
        if (!appid || !secret)
            throw new common_1.UnauthorizedException('微信小程序未配置');
        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
        const { data } = await axios_1.default.get(url, { timeout: 5000 });
        if (data.errcode)
            throw new common_1.UnauthorizedException(`微信登录失败：${data.errmsg}`);
        const { openid, unionid } = data;
        let user = await this.prisma.user.findUnique({ where: { openid } });
        if (!user) {
            user = await this.prisma.user.create({
                data: { openid, unionid: unionid || null, role: 'retail' },
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
            username: user.phone || user.openid,
            userType: 'client',
            role: user.role,
        });
        return { token, user: this.sanitize(user) };
    }
    /**
     * 手机号+验证码登录（零售、批发 H5 通用），演示版跳过短信校验
     */
    async phoneLogin(phone, code) {
        if (!phone || !code)
            throw new common_1.BadRequestException('手机号和验证码必填');
        // TODO: 生产环境请接入腾讯云短信 SDK 校验验证码
        if (code !== '123456')
            throw new common_1.UnauthorizedException('验证码错误');
        let user = await this.prisma.user.findUnique({ where: { phone } });
        if (!user) {
            user = await this.prisma.user.create({ data: { phone, role: 'retail' } });
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
        };
    }
};
exports.ClientAuthService = ClientAuthService;
exports.ClientAuthService = ClientAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], ClientAuthService);
//# sourceMappingURL=client-auth.service.js.map