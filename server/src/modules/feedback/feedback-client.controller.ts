import { Body, Controller, Post, Req } from '@nestjs/common'
import { Public } from '@/common/decorators/public.decorator'
import { FeedbackService, type FeedbackInput } from './feedback.service'

/**
 * 小程序客户端：提交客服反馈
 * 路径：POST /api/client/feedbacks
 */
@Controller('client/feedbacks')
export class FeedbackClientController {
  constructor(private readonly svc: FeedbackService) {}

  @Public()
  @Post()
  create(@Body() body: FeedbackInput, @Req() req: any) {
    const userId = req?.user?.id || req?.user?.userId || null
    return this.svc.create(body, userId)
  }
}
