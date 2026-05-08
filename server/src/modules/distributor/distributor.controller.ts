import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { DistributorService } from './distributor.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { AdminGuard } from '../../common/guards/admin.guard'

@Controller('admin/distributors')
@UseGuards(JwtAuthGuard, AdminGuard)
export class DistributorController {
  constructor(private readonly distributorService: DistributorService) {}

  @Get()
  list(@Query() query: any) {
    return this.distributorService.findAll(query)
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.distributorService.findById(id)
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.distributorService.update(id, body)
  }

  /** 审核接口：前端传 { pass: boolean, remark?: string } */
  @Post(':id/audit')
  audit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { pass: boolean; remark?: string },
    @Req() req: Request,
  ) {
    const user = (req as any).user || {}
    const operatorId = Number(user.id || user.adminId || 0)
    return this.distributorService.audit(id, !!body.pass, body.remark, operatorId)
  }
}
