import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface ApiResponse<T> {
  code: number
  data: T
  message: string
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        data: this.serialize(data),
        message: 'ok',
      })),
    )
  }

  // 处理 Decimal / BigInt 等 Prisma 特殊类型 -> JSON 可序列化
  private serialize(data: any): any {
    return JSON.parse(
      JSON.stringify(data, (_k, v) => {
        if (typeof v === 'bigint') return v.toString()
        if (v && typeof v === 'object' && v.constructor?.name === 'Decimal') return Number(v)
        return v
      }),
    )
  }
}
