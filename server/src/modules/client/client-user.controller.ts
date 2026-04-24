import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
} from '@nestjs/common'
import { IsOptional, IsString, MaxLength } from 'class-validator'
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator'
import { PrismaService } from '@/common/prisma.service'

class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(64)
  nickname?: string

  @IsOptional() @IsString() @MaxLength(500)
  avatar?: string

  @IsOptional()
  gender?: number // 0/1/2
}

@Controller('client/user')
export class ClientUserController {
  constructor(private readonly prisma: PrismaService) {}

  private ensureClient(user: JwtPayload) {
    if (user.userType !== 'client') throw new ForbiddenException('仅小程序用户可访问')
  }

  @Get('profile')
  async profile(@CurrentUser() user: JwtPayload) {
    this.ensureClient(user)
    const u = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: { level: true },
    })
    if (!u) return null
    return {
      id: u.id,
      nickname: u.nickname,
      avatar: u.avatar,
      phone: u.phone,
      gender: u.gender,
      role: u.role,
      level: u.level ? { id: u.level.id, name: u.level.name } : null,
      points: u.points,
      balance: u.balance,
      totalSpent: u.totalSpent,
      registeredAt: u.registeredAt,
    }
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    this.ensureClient(user)
    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        nickname: dto.nickname,
        avatar: dto.avatar,
        gender: dto.gender,
      },
    })
    return { ok: true, id: updated.id }
  }
}
