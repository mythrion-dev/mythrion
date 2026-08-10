import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { NotebookService } from './notebook.service.js'
import { createMockPrismaService } from '../__mocks__/prisma-service.mock.js'
import { createI18nServiceMock } from '../i18n/i18n-testing.js'

const makePage = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  folderId: null,
  title: 'Title',
  content: 'Content',
  sortOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
})

const makeFolder = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: 'Folder',
  sortOrder: 0,
  pages: [],
  ...overrides,
})

const makeNotebook = (overrides: Record<string, unknown> = {}) => ({
  id: 'nb1',
  adventureId: 'adv1',
  userId: 'u1',
  folders: [],
  pages: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
})

describe('NotebookService', () => {
  let prisma: any
  let redis: {
    cacheGet: jest.Mock
    cacheSet: jest.Mock
    invalidatePattern: jest.Mock
  }
  let membership: { isMember: jest.Mock }
  let service: NotebookService

  beforeEach(() => {
    prisma = createMockPrismaService() as any
    prisma.notebook = { findUnique: jest.fn(), create: jest.fn() }
    prisma.notebookFolder = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    }
    prisma.notebookPage = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    }
    redis = {
      cacheGet: jest.fn().mockResolvedValue(null),
      cacheSet: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    }
    membership = { isMember: jest.fn().mockResolvedValue(true) }
    service = new NotebookService(
      prisma,
      redis as any,
      membership as any,
      createI18nServiceMock() as any,
    )
  })

  describe('getOrCreateNotebook', () => {
    it('throws ForbiddenException when the user is not a member', async () => {
      membership.isMember.mockResolvedValue(false)
      const error = await service
        .getOrCreateNotebook('adv1', 'u1')
        .catch((e) => e)
      expect(error).toBeInstanceOf(ForbiddenException)
      expect(error.message).toBe('You are not a member of this campaign')
      expect(prisma.notebook.findUnique).not.toHaveBeenCalled()
    })

    it('returns the cached notebook without querying prisma', async () => {
      const cached = makeNotebook()
      redis.cacheGet.mockResolvedValue(cached)
      const result = await service.getOrCreateNotebook('adv1', 'u1')
      expect(result).toBe(cached)
      expect(prisma.notebook.findUnique).not.toHaveBeenCalled()
      expect(prisma.notebook.create).not.toHaveBeenCalled()
    })

    it('builds folder/root pages from a persisted notebook and caches it', async () => {
      redis.cacheGet.mockResolvedValue(null)
      prisma.notebook.findUnique.mockResolvedValue(
        makeNotebook({
          folders: [makeFolder('f1')],
          pages: [
            makePage('p1', { folderId: 'f1', title: 'In folder' }),
            makePage('p2', { title: 'Root page' }),
          ],
        }),
      )
      const result = await service.getOrCreateNotebook('adv1', 'u1')
      expect(prisma.notebook.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adventureId_userId: { adventureId: 'adv1', userId: 'u1' } },
        }),
      )
      expect(result.folders).toHaveLength(1)
      expect(result.folders[0].pages).toHaveLength(1)
      expect(result.folders[0].pages[0].title).toBe('In folder')
      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].title).toBe('Root page')
      expect(redis.cacheSet).toHaveBeenCalledWith(
        'campaign:adv1:user:u1:notebook',
        result,
        300,
      )
    })

    it('creates a notebook when none exists, then caches it', async () => {
      redis.cacheGet.mockResolvedValue(null)
      prisma.notebook.findUnique.mockResolvedValue(null)
      const created = makeNotebook()
      prisma.notebook.create.mockResolvedValue(created)
      const result = await service.getOrCreateNotebook('adv1', 'u1')
      expect(prisma.notebook.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { adventureId: 'adv1', userId: 'u1' } }),
      )
      expect(result.id).toBe('nb1')
      expect(redis.cacheSet).toHaveBeenCalled()
    })
  })

  describe('createFolder', () => {
    it('creates a folder with the next sort order after existing folders', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(
          makeNotebook({
            folders: [
              makeFolder('f1', { sortOrder: 1 }),
              makeFolder('f2', { sortOrder: 3 }),
            ],
          }),
        )
      prisma.notebookFolder.create.mockResolvedValue({
        id: 'f3',
        name: 'New',
        sortOrder: 4,
      })
      const result = await service.createFolder('adv1', 'u1', { name: 'New' })
      expect(prisma.notebookFolder.create).toHaveBeenCalledWith({
        data: { notebookId: 'nb1', name: 'New', sortOrder: 4 },
      })
      expect(result).toEqual({ id: 'f3', name: 'New', sortOrder: 4, pages: [] })
      expect(redis.invalidatePattern).toHaveBeenCalledWith(
        'campaign:adv1:user:u1:notebook*',
      )
    })

    it('uses sort order 0 when there are no existing folders', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook())
      prisma.notebookFolder.create.mockResolvedValue({
        id: 'f1',
        name: 'Only',
        sortOrder: 1,
      })
      await service.createFolder('adv1', 'u1', { name: 'Only' })
      expect(prisma.notebookFolder.create).toHaveBeenCalledWith({
        data: { notebookId: 'nb1', name: 'Only', sortOrder: 1 },
      })
    })
  })

  describe('updateFolder', () => {
    const ownedFolder = () => ({
      id: 'f1',
      name: 'Old',
      sortOrder: 1,
      notebook: { adventureId: 'adv1', userId: 'u1' },
    })

    it('updates the folder name only when name is provided', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook())
      prisma.notebookFolder.findUnique.mockResolvedValue(ownedFolder())
      prisma.notebookFolder.update.mockResolvedValue({
        id: 'f1',
        name: 'Renamed',
        sortOrder: 1,
      })
      const result = await service.updateFolder('adv1', 'u1', 'f1', {
        name: 'Renamed',
      })
      expect(prisma.notebookFolder.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: { name: 'Renamed' },
      })
      expect(result.name).toBe('Renamed')
    })

    it('updates the folder sort order only when name is absent', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook())
      prisma.notebookFolder.findUnique.mockResolvedValue(ownedFolder())
      prisma.notebookFolder.update.mockResolvedValue({
        id: 'f1',
        name: 'Old',
        sortOrder: 9,
      })
      const result = await service.updateFolder('adv1', 'u1', 'f1', {
        sortOrder: 9,
      })
      expect(prisma.notebookFolder.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: { sortOrder: 9 },
      })
      expect(result.sortOrder).toBe(9)
    })

    it('throws NotFoundException when the folder does not exist or is not owned', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook())
      prisma.notebookFolder.findUnique.mockResolvedValue(null)
      await expect(
        service.updateFolder('adv1', 'u1', 'f1', { name: 'x' }),
      ).rejects.toThrow(NotFoundException)
      prisma.notebookFolder.findUnique.mockResolvedValue({
        id: 'f1',
        notebook: { adventureId: 'adv2', userId: 'u1' },
      })
      await expect(
        service.updateFolder('adv1', 'u1', 'f1', { name: 'x' }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('deleteFolder', () => {
    it('detaches its pages, deletes the folder and invalidates the cache', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook())
      prisma.notebookFolder.findUnique.mockResolvedValue({
        id: 'f1',
        notebook: { adventureId: 'adv1', userId: 'u1' },
      })
      await service.deleteFolder('adv1', 'u1', 'f1')
      expect(prisma.notebookPage.updateMany).toHaveBeenCalledWith({
        where: { folderId: 'f1' },
        data: { folderId: null },
      })
      expect(prisma.notebookFolder.delete).toHaveBeenCalledWith({
        where: { id: 'f1' },
      })
      expect(redis.invalidatePattern).toHaveBeenCalled()
    })

    it('throws NotFoundException when the folder does not exist', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook())
      prisma.notebookFolder.findUnique.mockResolvedValue(null)
      await expect(
        service.deleteFolder('adv1', 'u1', 'f1'),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('createPage', () => {
    it('creates a page in a folder with the next sort order', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(
          makeNotebook({
            folders: [
              makeFolder('f1', { pages: [makePage('p1', { sortOrder: 5 })] }),
            ],
            pages: [makePage('p2', { sortOrder: 2 })],
          }),
        )
      prisma.notebookPage.create.mockResolvedValue({
        id: 'pg',
        folderId: 'f1',
        title: 'New',
        content: '',
        sortOrder: 6,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      const result = await service.createPage('adv1', 'u1', {
        title: 'New',
        folderId: 'f1',
      })
      expect(prisma.notebookPage.create).toHaveBeenCalledWith({
        data: { notebookId: 'nb1', folderId: 'f1', title: 'New', sortOrder: 6 },
      })
      expect(result.sortOrder).toBe(6)
    })

    it('creates a root page with folderId null and sort order 0 when empty', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook())
      prisma.notebookPage.create.mockResolvedValue({
        id: 'pg',
        folderId: null,
        title: 'New',
        content: '',
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      await service.createPage('adv1', 'u1', { title: 'New' })
      expect(prisma.notebookPage.create).toHaveBeenCalledWith({
        data: {
          notebookId: 'nb1',
          folderId: null,
          title: 'New',
          sortOrder: 1,
        },
      })
    })
  })

  describe('updatePage', () => {
    const ownedPage = () => ({
      id: 'p1',
      folderId: null,
      notebook: { adventureId: 'adv1', userId: 'u1' },
    })

    it('updates title and content when provided', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook())
      prisma.notebookPage.findUnique.mockResolvedValue(ownedPage())
      prisma.notebookPage.update.mockResolvedValue({
        id: 'p1',
        folderId: null,
        title: 'New',
        content: 'Body',
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      const result = await service.updatePage('adv1', 'u1', 'p1', {
        title: 'New',
        content: 'Body',
      })
      expect(prisma.notebookPage.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { title: 'New', content: 'Body' },
      })
      expect(result.title).toBe('New')
    })

    it('updates folderId and sortOrder when provided', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook())
      prisma.notebookPage.findUnique.mockResolvedValue(ownedPage())
      prisma.notebookPage.update.mockResolvedValue({
        id: 'p1',
        folderId: 'f2',
        title: 'T',
        content: 'C',
        sortOrder: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      const result = await service.updatePage('adv1', 'u1', 'p1', {
        folderId: 'f2',
        sortOrder: 3,
      })
      expect(prisma.notebookPage.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { folderId: 'f2', sortOrder: 3 },
      })
      expect(result.folderId).toBe('f2')
    })

    it('throws NotFoundException when the page does not exist or is not owned', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook())
      prisma.notebookPage.findUnique.mockResolvedValue(null)
      await expect(
        service.updatePage('adv1', 'u1', 'p1', { title: 'x' }),
      ).rejects.toThrow(NotFoundException)
      prisma.notebookPage.findUnique.mockResolvedValue({
        id: 'p1',
        notebook: { adventureId: 'adv1', userId: 'u2' },
      })
      await expect(
        service.updatePage('adv1', 'u1', 'p1', { title: 'x' }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('deletePage', () => {
    it('deletes the page and invalidates the cache', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook())
      prisma.notebookPage.findUnique.mockResolvedValue({
        id: 'p1',
        notebook: { adventureId: 'adv1', userId: 'u1' },
      })
      await service.deletePage('adv1', 'u1', 'p1')
      expect(prisma.notebookPage.delete).toHaveBeenCalledWith({
        where: { id: 'p1' },
      })
      expect(redis.invalidatePattern).toHaveBeenCalledWith(
        'campaign:adv1:user:u1:notebook*',
      )
    })

    it('throws NotFoundException when the page does not exist', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook())
      prisma.notebookPage.findUnique.mockResolvedValue(null)
      await expect(
        service.deletePage('adv1', 'u1', 'p1'),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('reorder', () => {
    it('updates folders, pages and ignores items without ids', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook())
      await service.reorder('adv1', 'u1', [
        { folderId: 'f1', sortOrder: 1 },
        { pageId: 'p1', sortOrder: 2 },
        { sortOrder: 3 },
      ])
      expect(prisma.notebookFolder.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: { sortOrder: 1 },
      })
      expect(prisma.notebookPage.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { sortOrder: 2 },
      })
      expect(redis.invalidatePattern).toHaveBeenCalledWith(
        'campaign:adv1:user:u1:notebook*',
      )
    })
  })

  describe('search', () => {
    it('matches title, folder name and content, strips HTML and dedupes', async () => {
      jest.spyOn(service, 'getOrCreateNotebook').mockResolvedValue(
        makeNotebook({
          folders: [
            makeFolder('f1', {
              name: 'Dragons',
              pages: [
                makePage('p2', { folderId: 'f1', title: 'Notes' }),
                makePage('p3', { folderId: 'f1', title: 'dup' }),
              ],
            }),
          ],
          pages: [
            makePage('p1', {
              title: 'Dragon Hunt',
              content: '<p>slay the dragon</p>',
            }),
            makePage('p2', { folderId: 'f1', title: 'Notes' }),
            makePage('p4', {
              title: 'Unrelated',
              content: '<p>a dragon hides here</p>',
            }),
          ],
        }),
      )
      const results = await service.search('adv1', 'u1', 'Dragon')
      expect(results.map((r) => r.id).sort()).toEqual(['p1', 'p2', 'p3', 'p4'])
      const p1 = results.find((r) => r.id === 'p1')
      expect(p1).toMatchObject({ title: 'Dragon Hunt', folderName: null })
      const p2 = results.find((r) => r.id === 'p2')
      expect(p2).toMatchObject({ folderName: 'Dragons' })
      const p3 = results.find((r) => r.id === 'p3')
      expect(p3).toMatchObject({ folderName: 'Dragons' })
      const p4 = results.find((r) => r.id === 'p4')
      expect(p4).toMatchObject({ title: 'Unrelated', folderName: null })
    })

    it('returns an empty array when nothing matches', async () => {
      jest
        .spyOn(service, 'getOrCreateNotebook')
        .mockResolvedValue(makeNotebook({ pages: [makePage('p1')] }))
      const results = await service.search('adv1', 'u1', 'zzzz')
      expect(results).toEqual([])
    })
  })
})
