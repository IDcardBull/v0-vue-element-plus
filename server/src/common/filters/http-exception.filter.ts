import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    let message = '服务器开小差了，请稍后再试'
    let code = status

    if (exception instanceof HttpException) {
      const r: any = exception.getResponse()
      message = typeof r === 'string' ? r : r.message || r.error || message
      if (Array.isArray(message)) message = message.join('；')
    } else if (exception instanceof Error) {
      message = exception.message
      this.logger.error(exception.stack)
    } else {
      this.logger.error(exception)
    }

    res.status(status).json({ code: code === 200 ? 1 : code, data: null, message })
  }
}
