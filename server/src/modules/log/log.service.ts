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
    operatorId?: number
    startTime?: string
    endTime?: string
  }) {
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 20
    const where: any = {}

    if (query.keyword) {
      where.OR = [
        { desc: { contains: query.keyword } },
        { operator: { contains: query.keyword } },
      ]
    }
    if (query.action) where.action = query.action
    if (query.status) where.status = query.status
    if (query.operatorId) where.operatorId = Number(query.operatorId)
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
    return this.prisma.operationLog.findUnique({ where: { id } })
  }

  async create(data: {
    operatorId?: number
    operator?: string
    module: string
    action: string
    desc?: string
    method?: string
    path?: string
    ip?: string
    userAgent?: string
    params?: any
    status: 'success' | 'fail'
    errorMsg?: string
    duration?: number
  }) {
    return this.prisma.operationLog.create({ data })
  }
}
