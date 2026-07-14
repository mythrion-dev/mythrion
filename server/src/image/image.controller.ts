import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Res,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { ImageService } from './image.service.js'
import type { Response, Request } from 'express'

@Controller('images')
export class ImageController {
  private readonly logger = new Logger(ImageController.name)

  constructor(private readonly imageService: ImageService) {}

  /**
   * POST /api/images/character-sheets/:sheetId/avatar
   * Upload a new avatar image for a character sheet.
   * Only the sheet owner (authenticated) can upload.
   */
  @Post('character-sheets/:sheetId/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAvatar(
    @Param('sheetId') sheetId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new NotFoundException('No file provided')
    }

    this.logger.log(`Uploading avatar for sheet ${sheetId}: ${file.originalname} (${file.mimetype})`)

    const result = await this.imageService.upload(sheetId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    })

    return { fileId: result.fileId }
  }

  /**
   * GET /api/images/character-sheets/:sheetId/avatar
   * Stream the avatar image. No auth required (used by <img> tags).
   */
  @Get('character-sheets/:sheetId/avatar')
  async getAvatar(
    @Param('sheetId') sheetId: string,
    @Res() res: Response,
  ) {
    try {
      const { stream, contentType, contentLength } = await this.imageService.getStream(sheetId)

      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Length', contentLength)
      res.setHeader('Cache-Control', 'public, max-age=86400') // cache for 1 day

      stream.pipe(res)
    } catch (err) {
      if (err instanceof NotFoundException) {
        // Return 204 No Content so the client knows there's no avatar
        res.status(204).end()
        return
      }
      throw err
    }
  }

  /**
   * DELETE /api/images/character-sheets/:sheetId/avatar
   * Remove the avatar image for a character sheet.
   * Only the sheet owner (authenticated) can delete.
   */
  @Delete('character-sheets/:sheetId/avatar')
  @UseGuards(JwtAuthGuard)
  async deleteAvatar(@Param('sheetId') sheetId: string) {
    await this.imageService.delete(sheetId)
    return { deleted: true }
  }
}
