import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { FeedbackService } from './feedback.service'

/**
 * PC 后台 - 客服反馈
 * 路径：/api/admin/feedbacks
 */
@Controller('admin/feedbacks')
export class FeedbackAdminController {
  constructor(private readonly svc: FeedbackService) {}

  @Get()
  list(@Query() q: any) {
    return this.svc.list({
      page: Number(q?.page) || 1,
      pageSize: Number(q?.pageSize) || 20,
      type: q?.type || undefined,
    })
  }

  @Post('test-wework')
  test(@Body() body: { url?: string }) {
    return this.svc.testWework(body?.url)
  }
}
