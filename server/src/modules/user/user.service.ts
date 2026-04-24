import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

/** 前端可能传 'active'/'disabled' 字符串，数据库是 Int（1/0） */
function toStatusInt(status: any): number | undefined {
  if (status === undefined || status === null || status === '') return undefined
  if (typeof status === 'number') return status
  return status === 'inactive' || status === 'disabled' || status === '0' ? 0 : 1
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // ============ 零售客户 ============
  async findCustomers(query: {
    page?: number
    pageSize?: number
    keyword?: string
    level?: string
    levelId?: number
    status?: any
  }) {
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 20
    const where: any = { role: 'retail' }

    if (query.keyword) {
      where.OR = [
        { nickname: { contains: query.keyword } },
        { phone: { contains: query.keyword } },
      ]
    }
    // level 可以是 level code（查 UserLevel.code）或直接 levelId
    if (query.levelId) {
      where.levelId = Number(query.levelId)
    } else if (query.level) {
      const lvl = await this.prisma.userLevel.findUnique({ where: { code: query.level } })
      if (lvl) where.levelId = lvl.id
      else where.levelId = -1 // 查不到就返回空
    }
    const statusInt = toStatusInt(query.status)
    if (statusInt !== undefined) where.status = statusInt

    const [list, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { level: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ])

    return { list, total, page, pageSize }
  }

  async findCustomerById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        level: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { items: true },
        },
        addresses: true,
      },
    })
    if (!user || user.role !== 'retail') {
      throw new NotFoundException('客户不存在')
    }
    return user
  }

  async updateCustomer(id: number, data: any) {
    const payload: any = {
      nickname: data.nickname,
    }
    if (data.levelId !== undefined) payload.levelId = data.levelId ? Number(data.levelId) : null
    else if (data.memberLevel) {
      // 允许通过 level code 更新
      const lvl = await this.prisma.userLevel.findUnique({ where: { code: data.memberLevel } })
      if (lvl) payload.levelId = lvl.id
    }
    const statusInt = toStatusInt(data.status)
    if (statusInt !== undefined) payload.status = statusInt

    return this.prisma.user.update({
      where: { id },
      data: payload,
    })
  }

  // ============ 分销商（查 Distributor 表） ============
  async findDistributors(query: {
    page?: number
    pageSize?: number
    keyword?: string
    level?: string
    auditStatus?: string
    status?: any
  }) {
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 20
    const where: any = {}

    if (query.keyword) {
      where.OR = [
        { companyName: { contains: query.keyword } },
        { contactName: { contains: query.keyword } },
        { contactPhone: { contains: query.keyword } },
      ]
    }
    if (query.level) where.level = query.level
    if (query.auditStatus) where.auditStatus = query.auditStatus

    const [list, total] = await Promise.all([
      this.prisma.distributor.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.distributor.count({ where }),
    ])

    return { list, total, page, pageSize }
  }

  async findDistributorById(id: number) {
    const distributor = await this.prisma.distributor.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            orders: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
      },
    })
    if (!distributor) throw new NotFoundException('分销商不存在')

    // 对账单是按 distributorId 查（Statement 表未声明 relation）
    const statements = await this.prisma.statement.findMany({
      where: { distributorId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return { ...distributor, statements }
  }

  async updateDistributor(id: number, data: any) {
    const payload: any = {
      companyName: data.companyName,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      region: data.region,
      level: data.level ?? data.dealerLevel,
      creditLimit: data.creditLimit,
      salesmanId: data.salesmanId ? Number(data.salesmanId) : undefined,
    }
    // 清掉 undefined 避免意外覆盖
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

    const distributor = await this.prisma.distributor.update({
      where: { id },
      data: payload,
    })

    // User.nickname / status 也可以同步更新
    if (data.nickname || data.status !== undefined) {
      const userPayload: any = {}
      if (data.nickname) userPayload.nickname = data.nickname
      const statusInt = toStatusInt(data.status)
      if (statusInt !== undefined) userPayload.status = statusInt
      if (Object.keys(userPayload).length) {
        await this.prisma.user.update({ where: { id: distributor.userId }, data: userPayload })
      }
    }

    return distributor
  }

  async auditDistributor(id: number, pass: boolean, remark?: string) {
    const distributor = await this.prisma.distributor.findUnique({ where: { id } })
    if (!distributor) throw new NotFoundException('分销商不存在')
    if (distributor.auditStatus === 'approved' && pass) {
      throw new BadRequestException('该分销商已审核通过')
    }

    const updated = await this.prisma.distributor.update({
      where: { id },
      data: {
        auditStatus: pass ? 'approved' : 'rejected',
        auditRemark: remark,
        auditedAt: new Date(),
      },
    })

    // 同步 User.status（通过审核 → 启用，拒绝 → 停用）
    await this.prisma.user.update({
      where: { id: distributor.userId },
      data: { status: pass ? 1 : 0 },
    })

    return updated
  }
}
