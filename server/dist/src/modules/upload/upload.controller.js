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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const node_path_1 = require("node:path");
const node_fs_1 = require("node:fs");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const uploadDir = (0, node_path_1.join)(process.cwd(), 'uploads');
(0, node_fs_1.mkdirSync)(uploadDir, { recursive: true });
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
let UploadController = class UploadController {
    upload(file) {
        if (!file)
            throw new common_1.BadRequestException('请上传 file 文件');
        const port = Number(process.env.PORT) || 3001;
        const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${port}`;
        if (file.filename) {
            return {
                url: `${publicBaseUrl}/uploads/${file.filename}`,
            };
        }
        if (!file.buffer)
            throw new common_1.BadRequestException('文件内容为空，请重新上传');
        const suffix = (0, node_path_1.extname)(file.originalname) || '.jpg';
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${suffix}`;
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(uploadDir, filename), file.buffer);
        return {
            url: `${publicBaseUrl}/uploads/${filename}`,
        };
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (!allowedMimeTypes.includes(file.mimetype)) {
                cb(new Error('只允许上传 JPG/PNG/GIF/WebP 图片'), false);
                return;
            }
            cb(null, true);
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UploadController.prototype, "upload", null);
exports.UploadController = UploadController = __decorate([
    (0, common_1.Controller)('upload')
], UploadController);
//# sourceMappingURL=upload.controller.js.map