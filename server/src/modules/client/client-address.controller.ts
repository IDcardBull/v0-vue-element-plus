import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common'
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator'
import { ClientAddressService } from './client-address.service'

class AddressDto {
  @IsString() @MaxLength(64) receiver: string
  @IsString() @MaxLength(20) phone: string
  @IsString() @MaxLength(32) province: string
  @IsString() @MaxLength(32) city: string
  @IsString() @MaxLength(32) district: string
  @IsString() @MaxLength(255) detail: string
  @IsOptional() @IsBoolean() isDefault?: boolean
  @IsOptional() @IsString() @MaxLength(16) tag?: string
}

@Controller('client/addresses')
export class ClientAddressController {
  constructor(private readonly svc: ClientAddressService) {}

  private ensureClient(user: JwtPayload) {
    if (user.userType !== 'client') throw new ForbiddenException('仅小程序用户可访问')
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    this.ensureClient(user)
    return this.svc.list(user.sub)
  }

  @Get(':id')
  detail(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    this.ensureClient(user)
    return this.svc.findOne(user.sub, id)
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: AddressDto) {
    this.ensureClient(user)
    return this.svc.create(user.sub, dto)
  }

  @Put(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddressDto,
  ) {
    this.ensureClient(user)
    return this.svc.update(user.sub, id, dto)
  }

  @Patch(':id/default')
  setDefault(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.ensureClient(user)
    return this.svc.setDefault(user.sub, id)
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.ensureClient(user)
    return this.svc.remove(user.sub, id)
  }
}
