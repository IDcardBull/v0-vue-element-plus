import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    rawBody: true, // 微信支付回调解密需要读取原始 body
  })

  // 全局前缀
  app.setGlobalPrefix('api')

  // 全局 DTO 校验
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  )

  // 统一响应 & 异常
  app.useGlobalInterceptors(new ResponseInterceptor())
  app.useGlobalFilters(new HttpExceptionFilter())

  // 跨域 - 支持 PC 管理端 + 零售 H5 + 批发 H5
  app.enableCors({
    origin: true,
    credentials: true,
  })

  const port = Number(process.env.PORT) || 3001
  await app.listen(port)
  Logger.log(`API running at http://localhost:${port}/api`, 'Bootstrap')
}

bootstrap()
