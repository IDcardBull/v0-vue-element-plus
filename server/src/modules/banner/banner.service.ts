import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'

export interface BannerInput {
  id?: number | string | null
  title?: string | null
  imageUrl?: string | null
  image?: string | null // 兼容前端旧字段
  linkUrl?: string | null
  link?: string | null
  sort?: number | string | null
  enabled?: boolean | number | null
}

function pickString(...vals: any[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

@Injectable()
export class BannerService {
  constructor(private readonly prisma: PrismaService) {}

  /** 后台：返回所有轮播（含已停用），用于 PC 编辑页 */
  async listAll() {
    return this.prisma.homeBanner.findMany({
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    })
  }

  /** 客户端：只返回启用的，按 sort 升序 */
  async listEnabled() {
    return this.prisma.homeBanner.findMany({
      where: { enabled: true },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    })
  }

  /**
   * PC 编辑页保存：整组覆盖式提交。
   * 使用事务把"删除已不存在的 + upsert 现存的"做成原子操作，
   * 这样运营拖拽 / 删除一条都能干净落库。
   */
  async replaceAll(payload: BannerInput[]) {
    const list = Array.isArray(payload) ? payload : []
    const sanitized = list
      .map((raw, idx) => {
        const imageUrl = pickString(raw.imageUrl, raw.image)
        if (!imageUrl) return null
        const idNum = raw.id != null && /^\d+$/.test(String(raw.id)) ? Number(raw.id) : null
        return {
          id: idNum,
          title: pickString(raw.title).slice(0, 128),
          imageUrl: imageUrl.slice(0, 500),
          linkUrl: pickString(raw.linkUrl, raw.link).slice(0, 500),
          sort: Number.isFinite(Number(raw.sort)) ? Number(raw.sort) : idx,
          enabled: raw.enabled === false || raw.enabled === 0 ? false : true,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    const keepIds = sanitized.map((s) => s.id).filter((id): id is number => typeof id === 'number')

    return this.prisma.$transaction(async (tx) => {
      // 删除掉前端没再上送的旧记录
      if (keepIds.length > 0) {
        await tx.homeBanner.deleteMany({ where: { NOT: { id: { in: keepIds } } } })
      } else {
        await tx.homeBanner.deleteMany({})
      }

      // upsert
      for (const item of sanitized) {
        if (item.id) {
          await tx.homeBanner.update({
            where: { id: item.id },
            data: {
              title: item.title,
              imageUrl: item.imageUrl,
              linkUrl: item.linkUrl,
              sort: item.sort,
              enabled: item.enabled,
            },
          })
        } else {
          await tx.homeBanner.create({
            data: {
              title: item.title,
              imageUrl: item.imageUrl,
              linkUrl: item.linkUrl,
              sort: item.sort,
              enabled: item.enabled,
            },
          })
        }
      }

      return tx.homeBanner.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] })
    })
  }
}
