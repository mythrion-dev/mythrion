import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
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
import { BookService } from './book.service.js'
import { CreateBookDto } from './dto/create-book.dto.js'
import { UpdateBookDto } from './dto/update-book.dto.js'
import type { Response, Request } from 'express'

@Controller('adventures/:adventureId/books')
@UseGuards(JwtAuthGuard)
export class BookController {
  private readonly logger = new Logger(BookController.name)

  constructor(private readonly bookService: BookService) {}

  /**
   * GET /api/adventures/:adventureId/books
   * List books for an adventure. GM sees all; Player sees only PLAYER_BOOK.
   */
  @Get()
  async list(
    @Param('adventureId') adventureId: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id
    return this.bookService.list(adventureId, userId)
  }

  /**
   * POST /api/adventures/:adventureId/books
   * Upload a new book (PDF). GM only.
   * Expects multipart/form-data with fields: file (PDF), name (string), visibility (optional enum).
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          cb(new Error('Only PDF files are allowed'), false)
          return
        }
        cb(null, true)
      },
    }),
  )
  async create(
    @Param('adventureId') adventureId: string,
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateBookDto,
  ) {
    if (!file) {
      throw new NotFoundException('No file provided')
    }

    const userId = (req as any).user?.id
    this.logger.log(`Uploading book "${dto.name}" for adventure ${adventureId}: ${file.originalname}`)

    return this.bookService.create(adventureId, userId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    }, dto)
  }

  /**
   * GET /api/adventures/:adventureId/books/:bookId/file
   * Stream a book's PDF. Member only; Player cannot access GM_BOOK.
   */
  @Get(':bookId/file')
  async getFile(
    @Param('adventureId') adventureId: string,
    @Param('bookId') bookId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = (req as any).user?.id

    try {
      const { stream, contentType, contentLength } = await this.bookService.getStream(
        adventureId,
        bookId,
        userId,
      )

      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Length', contentLength)
      res.setHeader('Cache-Control', 'public, max-age=86400') // cache for 1 day
      res.setHeader('Content-Disposition', 'inline')

      stream.pipe(res)
    } catch (err) {
      if (err instanceof NotFoundException) {
        res.status(404).json({ message: err.message })
        return
      }
      throw err
    }
  }

  /**
   * PATCH /api/adventures/:adventureId/books/:bookId
   * Update book metadata (name, visibility). GM only.
   */
  @Patch(':bookId')
  async update(
    @Param('adventureId') adventureId: string,
    @Param('bookId') bookId: string,
    @Req() req: Request,
    @Body() dto: UpdateBookDto,
  ) {
    const userId = (req as any).user?.id
    return this.bookService.update(adventureId, bookId, userId, dto)
  }

  /**
   * POST /api/adventures/:adventureId/books/:bookId/replace
   * Replace a book's PDF file. GM only.
   */
  @Post(':bookId/replace')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          cb(new Error('Only PDF files are allowed'), false)
          return
        }
        cb(null, true)
      },
    }),
  )
  async replaceFile(
    @Param('adventureId') adventureId: string,
    @Param('bookId') bookId: string,
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new NotFoundException('No file provided')
    }

    const userId = (req as any).user?.id
    this.logger.log(`Replacing file for book ${bookId} in adventure ${adventureId}: ${file.originalname}`)

    return this.bookService.replaceFile(adventureId, bookId, userId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    })
  }

  /**
   * DELETE /api/adventures/:adventureId/books/:bookId
   * Delete a book and its GridFS file. GM only.
   */
  @Delete(':bookId')
  async delete(
    @Param('adventureId') adventureId: string,
    @Param('bookId') bookId: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id
    await this.bookService.delete(adventureId, bookId, userId)
    return { deleted: true }
  }
}
