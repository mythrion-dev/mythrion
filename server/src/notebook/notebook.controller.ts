import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { NotebookService } from './notebook.service.js'
import { CreateFolderDto } from './dto/create-folder.dto.js'
import { CreatePageDto } from './dto/create-page.dto.js'
import { UpdateFolderDto } from './dto/update-folder.dto.js'
import { UpdatePageDto } from './dto/update-page.dto.js'
import type { Request } from 'express'

@Controller('adventures/:adventureId/notebook')
@UseGuards(JwtAuthGuard)
export class NotebookController {
  constructor(private readonly notebookService: NotebookService) {}

  /**
   * GET /api/adventures/:adventureId/notebook
   * Returns the full notebook with folders and pages (or creates one implicitly).
   * Member only.
   */
  @Get()
  async getNotebook(
    @Param('adventureId') adventureId: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.sub
    return this.notebookService.getOrCreateNotebook(adventureId, userId)
  }

  /**
   * POST /api/adventures/:adventureId/notebook/folders
   * Create a folder in the notebook. Member only.
   */
  @Post('folders')
  async createFolder(
    @Param('adventureId') adventureId: string,
    @Req() req: Request,
    @Body() dto: CreateFolderDto,
  ) {
    const userId = (req as any).user?.sub
    return this.notebookService.createFolder(adventureId, userId, dto)
  }

  /**
   * PATCH /api/adventures/:adventureId/notebook/folders/:folderId
   * Update a folder's name or sort order. Member only, ownership verified.
   */
  @Patch('folders/:folderId')
  async updateFolder(
    @Param('adventureId') adventureId: string,
    @Param('folderId') folderId: string,
    @Req() req: Request,
    @Body() dto: UpdateFolderDto,
  ) {
    const userId = (req as any).user?.sub
    return this.notebookService.updateFolder(adventureId, userId, folderId, dto)
  }

  /**
   * DELETE /api/adventures/:adventureId/notebook/folders/:folderId
   * Delete a folder; orphaned pages move to root. Member only, ownership verified.
   */
  @Delete('folders/:folderId')
  async deleteFolder(
    @Param('adventureId') adventureId: string,
    @Param('folderId') folderId: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.sub
    await this.notebookService.deleteFolder(adventureId, userId, folderId)
    return { deleted: true }
  }

  /**
   * POST /api/adventures/:adventureId/notebook/pages
   * Create a page. Member only.
   */
  @Post('pages')
  async createPage(
    @Param('adventureId') adventureId: string,
    @Req() req: Request,
    @Body() dto: CreatePageDto,
  ) {
    const userId = (req as any).user?.sub
    return this.notebookService.createPage(adventureId, userId, dto)
  }

  /**
   * PATCH /api/adventures/:adventureId/notebook/pages/:pageId
   * Update a page's title, content, folder, or sort order. Member only, ownership verified.
   */
  @Patch('pages/:pageId')
  async updatePage(
    @Param('adventureId') adventureId: string,
    @Param('pageId') pageId: string,
    @Req() req: Request,
    @Body() dto: UpdatePageDto,
  ) {
    const userId = (req as any).user?.sub
    return this.notebookService.updatePage(adventureId, userId, pageId, dto)
  }

  /**
   * DELETE /api/adventures/:adventureId/notebook/pages/:pageId
   * Delete a page. Member only, ownership verified.
   */
  @Delete('pages/:pageId')
  async deletePage(
    @Param('adventureId') adventureId: string,
    @Param('pageId') pageId: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.sub
    await this.notebookService.deletePage(adventureId, userId, pageId)
    return { deleted: true }
  }

  /**
   * PUT /api/adventures/:adventureId/notebook/reorder
   * Batch reorder folders and pages. Member only.
   */
  @Put('reorder')
  async reorder(
    @Param('adventureId') adventureId: string,
    @Req() req: Request,
    @Body() items: Array<{ folderId?: string; pageId?: string; sortOrder: number }>,
  ) {
    const userId = (req as any).user?.sub
    await this.notebookService.reorder(adventureId, userId, items)
    return { reordered: true }
  }

  /**
   * GET /api/adventures/:adventureId/notebook/search?q=...
   * Search pages by title, folder name, or content. Member only.
   */
  @Get('search')
  async search(
    @Param('adventureId') adventureId: string,
    @Req() req: Request,
    @Query('q') query: string,
  ) {
    const userId = (req as any).user?.sub
    return this.notebookService.search(adventureId, userId, query ?? '')
  }
}
