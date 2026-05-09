import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@/common/prisma.service'

/**
 * ============ 运费模板 ============
 * 字段命名：
 *   - 接口字段统一驼峰（templateName / calcType / defaultRule / specialRules /
 *     freeShippingEnabled / freeShippingRules）
 *   - DB 列保留 snake_case，由 Prisma 通过 @map 处理
 * 复杂规则结构（defaultRule / specialRules / freeShippingRules）以 Json 字段保存，
 * 避免引入若干跨表 join；前端按数组形态读写即可。
 */

interface ShippingRule {
  firstAmount: number
  firstPrice: number
  continueAmount: number
  continuePrice: number
}

interface SpecialRule extends ShippingRule {
  regions: string[]
}

interface FreeShippingRule {
  regions: string[]
  threshold: number
}

export interface ShippingTemplateInput {
  templateName?: string
  name?: string // 兼容字段
  calcType?: number | string
  defaultRule?: Partial<ShippingRule> | null
  specialRules?: Partial<SpecialRule>[] | null
  freeShippingEnabled?: boolean | number | null
  freeShippingRules?: Partial<FreeShippingRule>[] | null
}

function toNumberSafe(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function sanitizeRule(raw: any): ShippingRule {
  return {
    firstAmount: toNumberSafe(raw?.firstAmount, 1),
    firstPrice: toNumberSafe(raw?.firstPrice, 0),
    continueAmount: toNumberSafe(raw?.continueAmount, 1),
    continuePrice: toNumberSafe(raw?.continuePrice, 0),
  }
}

function sanitizeRegions(raw: any): string[] {
  if (!Array.isArray(raw)) return []
  const set = new Set<string>()
  for (const r of raw) {
    if (typeof r === 'string') {
      const v = r.trim().slice(0, 32)
      if (v) set.add(v)
      if (set.size >= 50) break
    }
  }
  return [...set]
}

function sanitizeSpecial(raw: any): SpecialRule | null {
  const regions = sanitizeRegions(raw?.regions)
  if (regions.length === 0) return null // 没选地区的行直接丢弃
  return { regions, ...sanitizeRule(raw) }
}

function sanitizeFreeRule(raw: any): FreeShippingRule | null {
  const regions = sanitizeRegions(raw?.regions)
  const threshold = toNumberSafe(raw?.threshold, 0)
  if (threshold <= 0) return null
  return { regions, threshold }
}

function normalizeInput(payload: ShippingTemplateInput) {
  const name = (payload.templateName ?? payload.name ?? '').toString().trim().slice(0, 128)
  if (!name) throw new BadRequestException('模板名称不能为空')

  const calcTypeNum = Number(payload.calcType)
  const calcType = calcTypeNum === 2 ? 2 : 1 // 默认按件

  const specialRules = Array.isArray(payload.specialRules)
    ? (payload.specialRules.map(sanitizeSpecial).filter(Boolean) as SpecialRule[])
    : []

  const freeShippingEnabled =
    payload.freeShippingEnabled === true || payload.freeShippingEnabled === 1
  const freeShippingRules = freeShippingEnabled
    ? Array.isArray(payload.freeShippingRules)
      ? (payload.freeShippingRules.map(sanitizeFreeRule).filter(Boolean) as FreeShippingRule[])
      : []
    : []

  return {
    name,
    calcType,
    // 三个 Json 字段：Prisma 需要 InputJsonValue（带 index signature 的 plain JSON），
    // 通过 unknown 桥接断言绕开 ShippingRule 等接口缺少 index signature 的报错。
    defaultRule: sanitizeRule(payload.defaultRule || {}) as unknown as Prisma.InputJsonValue,
    specialRules: specialRules as unknown as Prisma.InputJsonValue,
    freeShippingEnabled,
    freeShippingRules: freeShippingRules as unknown as Prisma.InputJsonValue,
  }
}

@Injectable()
export class ShippingTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.shippingTemplate.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })
  }

  async detail(id: number) {
    const found = await this.prisma.shippingTemplate.findUnique({ where: { id } })
    if (!found) throw new NotFoundException('运费模板不存在')
    return found
  }

  async create(payload: ShippingTemplateInput) {
    const data = normalizeInput(payload)
    const exists = await this.prisma.shippingTemplate.findUnique({
      where: { name: data.name },
      select: { id: true },
    })
    if (exists) throw new BadRequestException('模板名称已存在')
    return this.prisma.shippingTemplate.create({ data })
  }

  async update(id: number, payload: ShippingTemplateInput) {
    await this.detail(id) // 先确认存在
    const data = normalizeInput(payload)
    const conflict = await this.prisma.shippingTemplate.findFirst({
      where: { name: data.name, NOT: { id } },
      select: { id: true },
    })
    if (conflict) throw new BadRequestException('模板名称已存在')
    return this.prisma.shippingTemplate.update({ where: { id }, data })
  }

  async remove(id: number) {
    await this.detail(id)
    await this.prisma.shippingTemplate.delete({ where: { id } })
    return { success: true }
  }
}
