"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotifyModule = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const work_wx_service_1 = require("./work-wx.service");
/**
 * 全局通知模块。
 * 标 @Global 是为了让 OrderService / WechatPayNotifyController 等任意业务侧
 * 直接 inject WorkWxService，不必每个模块都把 NotifyModule 写进 imports。
 */
let NotifyModule = class NotifyModule {
};
exports.NotifyModule = NotifyModule;
exports.NotifyModule = NotifyModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [axios_1.HttpModule],
        providers: [work_wx_service_1.WorkWxService],
        exports: [work_wx_service_1.WorkWxService],
    })
], NotifyModule);
//# sourceMappingURL=notify.module.js.map