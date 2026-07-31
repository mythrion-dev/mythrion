jest.mock("nodemailer", () => {
  const mock = { createTransport: jest.fn() }
  // Provide both a default and named export so the mock works regardless of
  // how the module interop compiles the `import nodemailer` (CJS vs ESM).
  return { __esModule: true, ...mock, default: mock }
})
import { Test } from '@nestjs/testing'
import nodemailer from 'nodemailer'
import { EmailService } from './email.service'

const mockCreateTransport = nodemailer.createTransport as jest.Mock
const mockSendMail = jest.fn()

const SMTP_VARS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
]

async function buildService() {
  const module = await Test.createTestingModule({
    providers: [EmailService],
  }).compile()
  return module.get<EmailService>(EmailService)
}

describe('EmailService', () => {
  let service: EmailService
  const savedEnv: Record<string, string | undefined> = {}

  const baseParams = {
    to: 'player@test.com',
    campaignName: 'Test Campaign',
    inviterName: 'Mighty GM',
    role: 'PLAYER',
    inviteUrl: 'http://localhost:3001/invite/abc',
    expiresAt: new Date('2025-06-15'),
  }

  beforeAll(() => {
    for (const v of SMTP_VARS) savedEnv[v] = process.env[v]
  })

  afterAll(() => {
    for (const v of SMTP_VARS) {
      if (savedEnv[v] === undefined) delete process.env[v]
      else process.env[v] = savedEnv[v]
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
    for (const v of SMTP_VARS) delete process.env[v]
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail })
    mockSendMail.mockResolvedValue({ messageId: 'm1' })
  })

  describe('when SMTP_HOST is not set', () => {
    it('sends nothing and logs [DEV] message (does not throw)', async () => {
      service = await buildService()

      await expect(service.sendInvitation(baseParams)).resolves.toBeUndefined()

      expect(mockCreateTransport).not.toHaveBeenCalled()
      expect(mockSendMail).not.toHaveBeenCalled()
    })
  })

  describe('when SMTP_HOST is set', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com'
    })

    it('creates a transporter with host, port 587, no TLS, and auth', async () => {
      process.env.SMTP_USER = 'apikey'
      process.env.SMTP_PASS = 'secret'

      service = await buildService()
      await service.sendInvitation(baseParams)

      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: { user: 'apikey', pass: 'secret' },
      })
    })

    it('omits auth when SMTP_USER or SMTP_PASS is missing', async () => {
      service = await buildService()
      await service.sendInvitation(baseParams)

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ auth: undefined }),
      )
    })

    it('enables implicit TLS on port 465 when SMTP_SECURE is unset', async () => {
      process.env.SMTP_PORT = '465'

      service = await buildService()
      await service.sendInvitation(baseParams)

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ port: 465, secure: true }),
      )
    })

    it('honours SMTP_SECURE=true on a STARTTLS port', async () => {
      process.env.SMTP_SECURE = 'true'

      service = await buildService()
      await service.sendInvitation(baseParams)

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true }),
      )
    })

    it('calls sendMail with default from, subject and template', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'm1' })

      service = await buildService()
      await service.sendInvitation(baseParams)

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Mythrion <noreply@mythrion.com>',
          to: 'player@test.com',
          subject: 'Mighty GM invited you to Test Campaign',
          html: expect.stringContaining('Accept Invitation'),
        }),
      )
    })

    it('uses EMAIL_FROM when set', async () => {
      process.env.EMAIL_FROM = 'No-Reply <no-reply@mythrion.com.br>'

      service = await buildService()
      await service.sendInvitation(baseParams)

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'No-Reply <no-reply@mythrion.com.br>' }),
      )
    })

    it('builds HTML template with invitation details', async () => {
      service = await buildService()
      await service.sendInvitation({
        ...baseParams,
        campaignName: 'My Campaign',
        inviterName: 'Alice',
        role: 'GM',
        inviteUrl: 'https://mythrion.com/invite/token123',
        expiresAt: new Date('2025-07-01T12:00:00Z'),
      })

      const callArg = mockSendMail.mock.calls[0][0]
      expect(callArg.html).toContain('Alice invited you')
      expect(callArg.html).toContain('My Campaign')
      expect(callArg.html).toContain('GM')
      expect(callArg.html).toContain('https://mythrion.com/invite/token123')
      expect(callArg.html).toContain('July')
    })

    it('rejects when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP refused connection'))

      service = await buildService()

      await expect(service.sendInvitation(baseParams)).rejects.toThrow(
        'SMTP refused connection',
      )
    })
  })
})
