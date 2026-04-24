import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common'
import { LogService } from './log.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { AdminGuard } from '../../common/guards/admin.guard'

@Controller('admin/logs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class LogController {
  constructor(private logService: LogService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.logService.findAll(query)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.logService.findById(id)
  }
}
