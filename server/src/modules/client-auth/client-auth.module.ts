import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { ClientAuthController } from './client-auth.controller'
import { ClientAuthService } from './client-auth.service'
import { ClientModule } from '../client/client.module'

@Module({
  imports: [
    // 引入 ClientModule 拿 WechatPayService（按 channel 解析 AppID/Secret）
    ClientModule,
    // 注入 JwtService（与管理端 AuthModule 共用同一 JWT_SECRET，保证三端 token 互通）
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') || '7d' },
      }),
    }),
  ],
  controllers: [ClientAuthController],
  providers: [ClientAuthService],
  exports: [ClientAuthService],
})
export class ClientAuthModule {}
