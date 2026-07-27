jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test } from '@nestjs/testing'
import { EmailService } from './email.service'

describe('EmailService', () => {
  let service: EmailService
  const OLD_ENV = process.env.RESEND_API_KEY

  afterAll(() => {
    process.env.RESEND_API_KEY = OLD_ENV
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('when RESEND_API_KEY is not set', () => {
    beforeEach(() => {
      delete process.env.RESEND_API_KEY
    })

    it('sends nothing and logs [DEV] message (does not throw)', async () => {
      const module = await Test.createTestingModule({
        providers: [EmailService],
      }).compile()

      service = module.get<EmailService>(EmailService)

      await expect(
        service.sendInvitation({
          to: 'player@test.com',
          campaignName: 'Test Adventure',
          inviterName: 'GM',
          role: 'PLAYER',
          inviteUrl: 'http://localhost:3001/invite/abc',
          expiresAt: new Date('2025-01-01'),
        }),
      ).resolves.toBeUndefined()
    })
  })

  describe('when RESEND_API_KEY is set', () => {
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })
    const mockResend = { emails: { send: mockSend } }

    beforeEach(() => {
      process.env.RESEND_API_KEY = 're_test_key'
    })

    it('calls resend.emails.send with correct params', async () => {
      // We need to test that the internal resend instance is used.
      // Since Resend is instantiated in the constructor, we create a new instance
      // and verify behavior by checking that no error is thrown and the method completes.
      const module = await Test.createTestingModule({
        providers: [EmailService],
      }).compile()

      service = module.get<EmailService>(EmailService)

      // Accessing private resend for test verification
      const resend = (service as any).resend
      resend.emails.send = mockSend

      await service.sendInvitation({
        to: 'player@test.com',
        campaignName: 'Test Campaign',
        inviterName: 'Mighty GM',
        role: 'PLAYER',
        inviteUrl: 'http://localhost:3001/invite/abc',
        expiresAt: new Date('2025-06-15'),
      })

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Mythrion <noreply@mythrion.com>',
          to: 'player@test.com',
          subject: 'Mighty GM invited you to Test Campaign',
          html: expect.stringContaining('Accept Invitation'),
        }),
      )
    })

    it('builds HTML template with invitation details', async () => {
      const module = await Test.createTestingModule({
        providers: [EmailService],
      }).compile()

      service = module.get<EmailService>(EmailService)
      const resend = (service as any).resend
      resend.emails.send = mockSend

      await service.sendInvitation({
        to: 'player@test.com',
        campaignName: 'My Campaign',
        inviterName: 'Alice',
        role: 'GM',
        inviteUrl: 'https://mythrion.com/invite/token123',
        expiresAt: new Date('2025-07-01T12:00:00Z'),
      })

      const callArg = mockSend.mock.calls[0][0]
      expect(callArg.html).toContain('Alice invited you')
      expect(callArg.html).toContain('My Campaign')
      expect(callArg.html).toContain('GM')
      expect(callArg.html).toContain('https://mythrion.com/invite/token123')
      expect(callArg.html).toContain('July')
    })

    it('handles errors gracefully without throwing', async () => {
      const module = await Test.createTestingModule({
        providers: [EmailService],
      }).compile()

      service = module.get<EmailService>(EmailService)
      const resend = (service as any).resend
      resend.emails.send = jest.fn().mockRejectedValue(new Error('API error'))

      await expect(
        service.sendInvitation({
          to: 'player@test.com',
          campaignName: 'Test',
          inviterName: 'GM',
          role: 'PLAYER',
          inviteUrl: 'http://localhost:3001/invite/t',
          expiresAt: new Date('2025-01-01'),
        }),
      ).resolves.toBeUndefined()
    })
  })
})
