import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'

interface TierInput {
  minQty: number
  maxQty?: number | null
  price: number
}

@Injectable()
export class PriceTierService {
  constructor(private readonly prisma: PrismaService) {}

  /** 按 SKU 获取阶梯价列表 */
  async listBySku(skuId: number) {
    return this.prisma.priceTier.findMany({
      where: { skuId },
      orderBy: { minQty: 'asc' },
    })
  }

  /**
   * 全量替换 SKU 的阶梯价（管理端抽屉"保存阶梯价"走这里）
   * 执行前做区间校验：下一档 minQty 必须 > 上一档 maxQty
   */
  async replace(skuId: number, tiers: TierInput[]) {
    // 按 minQty 排序后校验
    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty)
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i]
      if (t.minQty <= 0) throw new BadRequestException(`第 ${i + 1} 档起订量必须 > 0`)
      if (t.maxQty != null && t.maxQty < t.minQty)
        throw new BadRequestException(`第 ${i + 1} 档最大数量必须 >= 最小数量`)
      if (t.price <= 0) throw new BadRequestException(`第 ${i + 1} 档价格必须 > 0`)
      if (i > 0) {
        const prev = sorted[i - 1]
        if (prev.maxQty != null && t.minQty <= prev.maxQty)
          throw new BadRequestException(`第 ${i + 1} 档与上一档数量区间重叠`)
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.priceTier.deleteMany({ where: { skuId } })
      if (sorted.length) {
        await tx.priceTier.createMany({
          data: sorted.map((t, idx) => ({
            skuId,
            minQty: t.minQty,
            maxQty: t.maxQty ?? null,
            price: t.price,
            sort: idx,
          })),
        })
      }
    })
    return this.listBySku(skuId)
  }

  /**
   * 根据下单数量匹配最合适的阶梯价
   * 给小程序/批发 H5 在下单计算时调用
   */
  async matchPrice(skuId: number, qty: number) {
    const tiers = await this.listBySku(skuId)
    const hit = tiers.find((t) => qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty))
    return hit ? Number(hit.price) : null
  }
}
