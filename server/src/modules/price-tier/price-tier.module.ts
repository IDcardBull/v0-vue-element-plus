import { Module } from '@nestjs/common'
import { PriceTierController } from './price-tier.controller'
import { PriceTierService } from './price-tier.service'

@Module({
  controllers: [PriceTierController],
  providers: [PriceTierService],
  exports: [PriceTierService],
})
export class PriceTierModule {}
