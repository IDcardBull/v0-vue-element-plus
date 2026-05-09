import { Controller, Get } from '@nestjs/common'
import { Public } from '@/common/decorators/public.decorator'
import { BannerService } from './banner.service'

/**
 * 小程序端 - 首页轮播图（公开读取）
 * B2C miniprogram utils/api.js 已经在调 GET /client/banners
 * 返回：[{ id, title, imageUrl, linkUrl, sort, enabled }]
 */
@Controller('client/banners')
export class BannerClientController {
  constructor(private readonly svc: BannerService) {}

  @Public()
  @Get()
  list() {
    return this.svc.listEnabled()
  }
}
