import { Body, Controller, Get, Post } from '@nestjs/common'
import { BannerService, type BannerInput } from './banner.service'

/**
 * PC 后台 - 首页轮播图维护
 * 路径与前端 src/api/home.ts 完全对齐：/api/home/banners
 * 全局有 JWT Guard，未加 @Public，需要登录。
 */
@Controller('home/banners')
export class BannerAdminController {
  constructor(private readonly svc: BannerService) {}

  @Get()
  list() {
    return this.svc.listAll()
  }

  @Post()
  save(@Body() body: BannerInput[] | { list: BannerInput[] }) {
    const list = Array.isArray(body) ? body : Array.isArray(body?.list) ? body.list : []
    return this.svc.replaceAll(list)
  }
}
