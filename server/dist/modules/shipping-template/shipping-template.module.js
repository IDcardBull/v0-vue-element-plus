"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShippingTemplateModule = void 0;
const common_1 = require("@nestjs/common");
const shipping_template_service_1 = require("./shipping-template.service");
const shipping_template_controller_1 = require("./shipping-template.controller");
let ShippingTemplateModule = class ShippingTemplateModule {
};
exports.ShippingTemplateModule = ShippingTemplateModule;
exports.ShippingTemplateModule = ShippingTemplateModule = __decorate([
    (0, common_1.Module)({
        controllers: [shipping_template_controller_1.ShippingTemplateController],
        providers: [shipping_template_service_1.ShippingTemplateService],
        exports: [shipping_template_service_1.ShippingTemplateService],
    })
], ShippingTemplateModule);
//# sourceMappingURL=shipping-template.module.js.map