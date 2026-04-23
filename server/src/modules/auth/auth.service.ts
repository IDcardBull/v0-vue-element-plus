import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '@/common/prisma.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async adminLogin(username: string, password: string, ip?: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { username },
      include: { roles: { include: { role: true } } },
    })
    if (!admin) throw new UnauthorizedException('账号或密码错误')
    if (admin.status !== 1) throw new UnauthorizedException('账号已被停用')

    const ok = await bcrypt.compare(password, admin.password)
    if (!ok) throw new UnauthorizedException('账号或密码错误')

    // 组装角色与权限
    const roleCodes = admin.roles.map((r) => r.role.code)
    const perms = [
      ...new Set(
        admin.roles.flatMap((r) => (r.role.menuPerms as string[]) || []),
      ),
    ]

    const token = await this.jwt.signAsync({
      sub: admin.id,
      username: admin.username,
      userType: 'admin',
      roles: roleCodes,
      perms,
    })

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip || null },
    })

    return {
      token,
      user: {
        id: admin.id,
        username: admin.username,
        realName: admin.realName,
        avatar: admin.avatar,
        department: admin.department,
        roles: roleCodes,
        perms,
      },
    }
  }

  async getProfile(adminId: number) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      include: { roles: { include: { role: true } } },
    })
    if (!admin) throw new UnauthorizedException('账号不存在')
    const roleCodes = admin.roles.map((r) => r.role.code)
    const perms = [
      ...new Set(admin.roles.flatMap((r) => (r.role.menuPerms as string[]) || [])),
    ]
    return {
      id: admin.id,
      username: admin.username,
      realName: admin.realName,
      avatar: admin.avatar,
      phone: admin.phone,
      email: admin.email,
      department: admin.department,
      roles: roleCodes,
      perms,
      lastLoginAt: admin.lastLoginAt,
      lastLoginIp: admin.lastLoginIp,
    }
  }
}
