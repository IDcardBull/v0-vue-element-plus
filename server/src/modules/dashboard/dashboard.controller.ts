import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { DashboardService } from './dashboard.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { AdminGuard } from '../../common/guards/admin.guard'

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, AdminGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('overview')
  overview(@Query('channel') channel?: string) {
    return this.dashboardService.overview(channel)
  }

  @Get('sales-trend')
  salesTrend(@Query('days') days?: string) {
    return this.dashboardService.salesTrend(days ? Number(days) : 30)
  }

  @Get('top-products')
  topProducts(@Query('limit') limit?: string) {
    return this.dashboardService.topProducts(limit ? Number(limit) : 10)
  }
}
