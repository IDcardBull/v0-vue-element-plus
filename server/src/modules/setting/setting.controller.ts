import { Body, Controller, Get, Param, Put } from '@nestjs/common'
import { SettingService } from './setting.service'

@Controller('admin/settings')
export class SettingController {
  constructor(private readonly svc: SettingService) {}

  @Get()
  list() {
    return this.svc.listAll()
  }

  @Get(':key')
  get(@Param('key') key: string) {
    return this.svc.get(key)
  }

  @Put(':key')
  put(@Param('key') key: string, @Body() body: { value?: string; remark?: string }) {
    return this.svc.upsert(key, String(body?.value ?? ''), body?.remark)
  }
}
