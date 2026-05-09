import { Module } from '@nestjs/common'
import { BannerService } from './banner.service'
import { BannerAdminController } from './banner-admin.controller'
import { BannerClientController } from './banner-client.controller'

@Module({
  controllers: [BannerAdminController, BannerClientController],
  providers: [BannerService],
  exports: [BannerService],
})
export class BannerModule {}
