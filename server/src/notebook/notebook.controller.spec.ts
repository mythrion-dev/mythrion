jest.mock('pg', () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }))
jest.mock('../generated/prisma/client', () =>
  new Proxy(
    { PrismaClient: class {} },
    {
      get(target, prop) {
        if (prop in target) return target[prop]
        return {}
      },
    },
  ),
)
jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid') }))
jest.mock('geoip-lite', () => ({ lookup: jest.fn() }))

import { NotebookController } from './notebook.controller.js'

describe('NotebookController', () => {
  let service: {
    getOrCreateNotebook: jest.Mock
    createFolder: jest.Mock
    updateFolder: jest.Mock
    deleteFolder: jest.Mock
    createPage: jest.Mock
    updatePage: jest.Mock
    deletePage: jest.Mock
    reorder: jest.Mock
    search: jest.Mock
  }
  let controller: NotebookController
  const req = { user: { sub: 'u1' } } as any

  beforeEach(() => {
    service = {
      getOrCreateNotebook: jest.fn().mockResolvedValue('notebook'),
      createFolder: jest.fn().mockResolvedValue('folder'),
      updateFolder: jest.fn().mockResolvedValue('updated-folder'),
      deleteFolder: jest.fn().mockResolvedValue(undefined),
      createPage: jest.fn().mockResolvedValue('page'),
      updatePage: jest.fn().mockResolvedValue('updated-page'),
      deletePage: jest.fn().mockResolvedValue(undefined),
      reorder: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue(['result']),
    }
    controller = new NotebookController(service as any)
  })

  it('getNotebook delegates to getOrCreateNotebook with the user sub', async () => {
    const result = await controller.getNotebook('adv1', req)
    expect(service.getOrCreateNotebook).toHaveBeenCalledWith('adv1', 'u1')
    expect(result).toBe('notebook')
  })

  it('createFolder delegates to createFolder', async () => {
    const dto = { name: 'Folder' }
    const result = await controller.createFolder('adv1', req, dto as any)
    expect(service.createFolder).toHaveBeenCalledWith('adv1', 'u1', dto)
    expect(result).toBe('folder')
  })

  it('updateFolder delegates to updateFolder', async () => {
    const dto = { name: 'Renamed' }
    const result = await controller.updateFolder('adv1', 'f1', req, dto as any)
    expect(service.updateFolder).toHaveBeenCalledWith('adv1', 'u1', 'f1', dto)
    expect(result).toBe('updated-folder')
  })

  it('deleteFolder delegates and returns { deleted: true }', async () => {
    const result = await controller.deleteFolder('adv1', 'f1', req)
    expect(service.deleteFolder).toHaveBeenCalledWith('adv1', 'u1', 'f1')
    expect(result).toEqual({ deleted: true })
  })

  it('createPage delegates to createPage', async () => {
    const dto = { title: 'Page' }
    const result = await controller.createPage('adv1', req, dto as any)
    expect(service.createPage).toHaveBeenCalledWith('adv1', 'u1', dto)
    expect(result).toBe('page')
  })

  it('updatePage delegates to updatePage', async () => {
    const dto = { title: 'New' }
    const result = await controller.updatePage('adv1', 'p1', req, dto as any)
    expect(service.updatePage).toHaveBeenCalledWith('adv1', 'u1', 'p1', dto)
    expect(result).toBe('updated-page')
  })

  it('deletePage delegates and returns { deleted: true }', async () => {
    const result = await controller.deletePage('adv1', 'p1', req)
    expect(service.deletePage).toHaveBeenCalledWith('adv1', 'u1', 'p1')
    expect(result).toEqual({ deleted: true })
  })

  it('reorder delegates and returns { reordered: true }', async () => {
    const items = [{ folderId: 'f1', sortOrder: 1 }]
    const result = await controller.reorder('adv1', req, items as any)
    expect(service.reorder).toHaveBeenCalledWith('adv1', 'u1', items)
    expect(result).toEqual({ reordered: true })
  })

  it('search passes the query through', async () => {
    const result = await controller.search('adv1', req, 'dragon')
    expect(service.search).toHaveBeenCalledWith('adv1', 'u1', 'dragon')
    expect(result).toEqual(['result'])
  })

  it('search falls back to an empty string when the query is undefined', async () => {
    await controller.search('adv1', req, undefined)
    expect(service.search).toHaveBeenCalledWith('adv1', 'u1', '')
  })
})
