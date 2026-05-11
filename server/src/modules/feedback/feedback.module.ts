import { Module } from '@nestjs/common'
import { FeedbackService } from './feedback.service'
import { FeedbackClientController } from './feedback-client.controller'
import { FeedbackAdminController } from './feedback-admin.controller'
import { SettingModule } from '../setting/setting.module'

@Module({
  imports: [SettingModule],
  controllers: [FeedbackClientController, FeedbackAdminController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
