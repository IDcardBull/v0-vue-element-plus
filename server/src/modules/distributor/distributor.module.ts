import { Module } from '@nestjs/common'
import { DistributorController } from './distributor.controller'
import { DistributorService } from './distributor.service'

// NotifyModule 已 @Global，DistributorService 注入 WorkWxService 不需 imports
@Module({
  controllers: [DistributorController],
  providers: [DistributorService],
})
export class DistributorModule {}
