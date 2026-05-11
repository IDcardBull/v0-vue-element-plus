import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'

@Injectable()
export class SettingService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll() {
    return this.prisma.setting.findMany({ orderBy: { key: 'asc' } })
  }

  async get(key: string) {
    const row = await this.prisma.setting.findUnique({ where: { key } })
    return row || { key, value: '', remark: '' }
  }

  async getValue(key: string): Promise<string> {
    const row = await this.prisma.setting.findUnique({ where: { key } })
    return row?.value || ''
  }

  async upsert(key: string, value: string, remark?: string) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value: value ?? '', ...(remark != null ? { remark } : {}) },
      create: { key, value: value ?? '', remark: remark || '' },
    })
  }
}
