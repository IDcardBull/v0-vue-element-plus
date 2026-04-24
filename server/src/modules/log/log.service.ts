import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

@Injectable()
export class LogService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    page?: number
    pageSize?: number
    keyword?: string
    action?: string
    status?: string
    adminUserId?: number
    operatorId?: number
    startTime?: string
    endTime?: string
  }) {
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 20
    const where: any = {}

    if (query.keyword) {
      where.OR = [
        { description: { contains: query.keyword } },
        { username: { contains: query.keyword } },
      ]
    }
    if (query.action) where.action = query.action
    if (query.status) where.status = query.status
    const adminUserId = query.adminUserId ?? query.operatorId
    if (adminUserId) where.adminUserId = Number(adminUserId)
    if (query.startTime || query.endTime) {
      where.createdAt = {}
      if (query.startTime) where.createdAt.gte = new Date(query.startTime)
      if (query.endTime) where.createdAt.lte = new Date(query.endTime)
    }

    const [list, total] = await Promise.all([
      this.prisma.operationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.operationLog.count({ where }),
    ])

    return { list, total, page, pageSize }
  }

  async findById(id: number) {
    return this.prisma.operationLog.findUnique({ where: { id: BigInt(id) } })
  }

  async create(data: {
    adminUserId?: number
    operatorId?: number
    username?: string
    operator?: string
    module: string
    action: string
    description?: string
    desc?: string
    method?: string
    path?: string
    ip?: string
    userAgent?: string
    params?: any
    status?: 'success' | 'fail'
    errorMsg?: string
    durationMs?: number
    duration?: number
  }) {
    return this.prisma.operationLog.create({
      data: {
        adminUserId: data.adminUserId ?? data.operatorId,
        username: data.username ?? data.operator ?? 'system',
        module: data.module,
        action: data.action,
        description: data.description ?? data.desc ?? '',
        method: data.method,
        path: data.path,
        ip: data.ip,
        userAgent: data.userAgent,
        params: data.params ?? undefined,
        status: data.status ?? 'success',
        errorMsg: data.errorMsg,
        durationMs: data.durationMs ?? data.duration,
      },
    })
  }
}
