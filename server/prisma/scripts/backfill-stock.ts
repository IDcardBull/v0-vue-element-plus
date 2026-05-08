/**
 * 一次性脚本：给所有"在 Stock 表里没有任何记录"的 SKU 补一条占位库存。
 *
 * 用途：
 *   - 在我们把"创建/编辑商品时自动 upsert Stock"这个逻辑加进 product.service 之前，
 *     已经存在的 SKU 没有 Stock 行，下单时会触发 BadRequestException("库存记录缺失")。
 *   - 此脚本会找到这些 SKU，在 isDefault=true 的仓库（找不到则取第一个仓库）里
 *     新建一条 onHand=0、reserved=0 的占位行；如果一个仓库也没有，会自动建一个"默认仓"。
 *
 * 用法：
 *   cd server
 *   pnpm tsx prisma/scripts/backfill-stock.ts
 *
 * 安全特性：
 *   - 只创建，不会覆盖已有库存
 *   - 可重复执行（幂等）
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. 找/建默认仓库
  let warehouse = await prisma.warehouse.findFirst({ where: { isDefault: true } })
  if (!warehouse) {
    warehouse = await prisma.warehouse.findFirst()
  }
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: { name: '默认仓', code: 'DEFAULT', isDefault: true, status: 1 },
    })
    console.log(`[backfill-stock] 没有仓库，已创建默认仓 id=${warehouse.id}`)
  }

  // 2. 拉所有 SKU
  const skus = await prisma.sku.findMany({
    select: { id: true, code: true, stock: true, productId: true },
  })

  // 3. 拉所有已有 Stock 的 skuId
  const existingStocks = await prisma.stock.findMany({ select: { skuId: true } })
  const haveStock = new Set(existingStocks.map((s) => s.skuId))

  const need = skus.filter((s) => !haveStock.has(s.id))
  console.log(
    `[backfill-stock] SKU 共 ${skus.length} 个，缺库存记录 ${need.length} 个，仓库 id=${warehouse.id}`,
  )

  for (const sku of need) {
    // 把 SKU 自带的 stock 字段当作初始 onHand（之前老数据保留在这里）
    const onHand = Math.max(Number(sku.stock || 0), 0)
    await prisma.stock.create({
      data: {
        skuId: sku.id,
        warehouseId: warehouse.id,
        onHand,
        reserved: 0,
      },
    })
    console.log(
      `[backfill-stock] +stock skuId=${sku.id} code=${sku.code} onHand=${onHand}`,
    )
  }

  console.log('[backfill-stock] 完成')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
