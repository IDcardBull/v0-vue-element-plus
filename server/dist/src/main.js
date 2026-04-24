"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const response_interceptor_1 = require("./common/interceptors/response.interceptor");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log'],
        rawBody: true, // 微信支付回调解密需要读取原始 body
    });
    // 全局前缀
    app.setGlobalPrefix('api');
    // 全局 DTO 校验
    app.useGlobalPipes(new common_1.ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
    }));
    // 统一响应 & 异常
    app.useGlobalInterceptors(new response_interceptor_1.ResponseInterceptor());
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    // 跨域 - 支持 PC 管理端 + 零售 H5 + 批发 H5
    app.enableCors({
        origin: true,
        credentials: true,
    });
    const port = Number(process.env.PORT) || 3001;
    await app.listen(port);
    common_1.Logger.log(`API running at http://localhost:${port}/api`, 'Bootstrap');
}
bootstrap();
//# sourceMappingURL=main.js.map