"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributorModule = void 0;
const common_1 = require("@nestjs/common");
const distributor_controller_1 = require("./distributor.controller");
const distributor_service_1 = require("./distributor.service");
// NotifyModule 已 @Global，DistributorService 注入 WorkWxService 不需 imports
let DistributorModule = class DistributorModule {
};
exports.DistributorModule = DistributorModule;
exports.DistributorModule = DistributorModule = __decorate([
    (0, common_1.Module)({
        controllers: [distributor_controller_1.DistributorController],
        providers: [distributor_service_1.DistributorService],
    })
], DistributorModule);
//# sourceMappingURL=distributor.module.js.map