import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { extname, join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { Public } from '@/common/decorators/public.decorator'

const uploadDir = join(process.cwd(), 'uploads')
mkdirSync(uploadDir, { recursive: true })

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

@Controller('upload')
export class UploadController {
  @Public()
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!allowedMimeTypes.includes(file.mimetype)) {
          cb(new Error('只允许上传 JPG/PNG/GIF/WebP 图片'), false)
          return
        }
        cb(null, true)
      },
    }),
  )
  upload(@UploadedFile() file?: any) {
    if (!file) throw new BadRequestException('请上传 file 文件')

    const port = Number(process.env.PORT) || 3001
    const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${port}`

    if (file.filename) {
      return {
        url: `${publicBaseUrl}/uploads/${file.filename}`,
      }
    }

    if (!file.buffer) throw new BadRequestException('文件内容为空，请重新上传')

    const suffix = extname(file.originalname) || '.jpg'
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${suffix}`
    writeFileSync(join(uploadDir, filename), file.buffer)
    return {
      url: `${publicBaseUrl}/uploads/${filename}`,
    }
  }
}
