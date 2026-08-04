jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

import { Test } from "@nestjs/testing"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { I18nService } from "nestjs-i18n"
import * as bcrypt from "bcrypt"
import { TwoFactorService } from "./two-factor.service"
import { PrismaService } from "../prisma.service"
import { EmailService } from "../email/email.service"
import { createI18nServiceMock } from "../i18n/i18n-testing.js"
import { createMockPrismaServiceWithData } from "../__mocks__/prisma-service.mock"

const mockEmailService = {
  sendTwoFactorCode: jest.fn().mockResolvedValue(undefined),
}

const future = () => new Date(Date.now() + 60_000)
const past = () => new Date(Date.now() - 60_000)

/* eslint-disable @typescript-eslint/no-explicit-any */
function seededChallenge(overrides: Record<string, any> = {}) {
  return {
    id: "ch-1",
    userId: "user-1",
    purpose: "LOGIN",
    codeHash: "hashed-code",
    expiresAt: future(),
    attempts: 0,
    usedAt: null,
    // Seeded findUnique does not hydrate `include.user` relations, so the
    // challenge rows embed their user object directly.
    user: { id: "user-1", email: "test@test.com" },
    ...overrides,
  }
}

function seededRecoveryCode(overrides: Record<string, any> = {}) {
  return {
    id: "rc-1",
    userId: "user-1",
    codeHash: "hashed-recovery",
    usedAt: null,
    ...overrides,
  }
}

async function buildService(
  initialData: Record<string, Record<string, any>[]> = {},
) {
  const data: Record<string, Record<string, any>[]> = {
    user: [{ id: "user-1", email: "test@test.com", twoFactorEnabled: false }],
    ...initialData,
  }
  const prisma = createMockPrismaServiceWithData(data)
  const module = await Test.createTestingModule({
    providers: [
      TwoFactorService,
      { provide: PrismaService, useValue: prisma },
      { provide: EmailService, useValue: mockEmailService },
      { provide: I18nService, useValue: createI18nServiceMock() },
    ],
  }).compile()
  const service = module.get<TwoFactorService>(TwoFactorService)
  return { service, prisma }
}

describe("TwoFactorService", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(bcrypt.hash as jest.Mock).mockResolvedValue("hashed-code")
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
  })

  describe("generateOtp", () => {
    it("returns a 6-digit numeric code", async () => {
      const { service } = await buildService()
      expect(service.generateOtp()).toMatch(/^\d{6}$/)
    })
  })

  describe("issueChallenge", () => {
    it("creates a hashed challenge and emails the code", async () => {
      const { service, prisma } = await buildService()

      const result = await service.issueChallenge("user-1", "LOGIN")

      const sentCode = (bcrypt.hash as jest.Mock).mock.calls[0][0]
      expect(sentCode).toMatch(/^\d{6}$/)
      expect(bcrypt.hash).toHaveBeenCalledWith(sentCode, 10)
      expect(prisma.twoFactorChallenge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          purpose: "LOGIN",
          codeHash: "hashed-code",
          expiresAt: expect.any(Date),
        }),
      })
      expect(mockEmailService.sendTwoFactorCode).toHaveBeenCalledWith({
        to: "test@test.com",
        code: sentCode,
        expiresInMinutes: 10,
      })
      expect(result).toEqual({ twoFactorId: expect.any(String) })
    })

    it("throws NotFoundException when the user does not exist", async () => {
      const { service } = await buildService({ user: [] })

      await expect(service.issueChallenge("missing", "LOGIN")).rejects.toThrow(
        NotFoundException,
      )
      expect(mockEmailService.sendTwoFactorCode).not.toHaveBeenCalled()
    })

    it("rolls back the challenge when the email fails", async () => {
      const { service, prisma } = await buildService()
      mockEmailService.sendTwoFactorCode.mockRejectedValueOnce(
        new Error("mail down"),
      )

      await expect(
        service.issueChallenge("user-1", "LOGIN"),
      ).rejects.toThrow(BadRequestException)
      expect(prisma.twoFactorChallenge.delete).toHaveBeenCalledWith({
        where: { id: expect.any(String) },
      })
    })
  })

  describe("resendLoginCode", () => {
    it("invalidates the old challenge and issues a fresh one", async () => {
      const { service, prisma } = await buildService({
        twoFactorChallenge: [seededChallenge()],
      })

      const result = await service.resendLoginCode("ch-1")

      expect(prisma.twoFactorChallenge.update).toHaveBeenCalledWith({
        where: { id: "ch-1" },
        data: { usedAt: expect.any(Date) },
      })
      expect(mockEmailService.sendTwoFactorCode).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ twoFactorId: expect.any(String) })
      expect(result.twoFactorId).not.toBe("ch-1")
    })

    it("throws when the challenge does not exist", async () => {
      const { service } = await buildService()

      await expect(service.resendLoginCode("missing")).rejects.toThrow(
        BadRequestException,
      )
    })

    it("throws when the challenge is not a LOGIN challenge", async () => {
      const { service } = await buildService({
        twoFactorChallenge: [seededChallenge({ purpose: "ENABLE" })],
      })

      await expect(service.resendLoginCode("ch-1")).rejects.toThrow(
        BadRequestException,
      )
    })

    it("throws when the challenge is already used", async () => {
      const { service } = await buildService({
        twoFactorChallenge: [seededChallenge({ usedAt: new Date() })],
      })

      await expect(service.resendLoginCode("ch-1")).rejects.toThrow(
        BadRequestException,
      )
    })

    it("throws when the challenge has expired", async () => {
      const { service } = await buildService({
        twoFactorChallenge: [seededChallenge({ expiresAt: past() })],
      })

      await expect(service.resendLoginCode("ch-1")).rejects.toThrow(
        BadRequestException,
      )
    })
  })

  describe("verifyChallenge", () => {
    it("returns the user when the OTP matches", async () => {
      const { service, prisma } = await buildService({
        twoFactorChallenge: [seededChallenge()],
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)

      const result = await service.verifyChallenge("ch-1", "123456")

      expect(bcrypt.compare).toHaveBeenCalledWith("123456", "hashed-code")
      expect(prisma.twoFactorChallenge.update).toHaveBeenCalledWith({
        where: { id: "ch-1" },
        data: { usedAt: expect.any(Date) },
      })
      expect(result).toEqual({ userId: "user-1", email: "test@test.com" })
    })

    it("increments attempts and throws on a wrong code", async () => {
      const { service, prisma } = await buildService({
        twoFactorChallenge: [seededChallenge()],
      })

      await expect(service.verifyChallenge("ch-1", "000000")).rejects.toThrow(
        BadRequestException,
      )
      expect(prisma.twoFactorChallenge.update).toHaveBeenCalledWith({
        where: { id: "ch-1" },
        data: { attempts: 1 },
      })
    })

    it("marks the challenge used on the final allowed attempt", async () => {
      const { service, prisma } = await buildService({
        twoFactorChallenge: [seededChallenge({ attempts: 4 })],
      })

      await expect(service.verifyChallenge("ch-1", "000000")).rejects.toThrow(
        BadRequestException,
      )
      expect(prisma.twoFactorChallenge.update).toHaveBeenCalledWith({
        where: { id: "ch-1" },
        data: { attempts: 5, usedAt: expect.any(Date) },
      })
    })

    it("throws when the challenge is expired", async () => {
      const { service } = await buildService({
        twoFactorChallenge: [seededChallenge({ expiresAt: past() })],
      })

      await expect(service.verifyChallenge("ch-1", "123456")).rejects.toThrow(
        BadRequestException,
      )
      expect(bcrypt.compare).not.toHaveBeenCalled()
    })

    it("throws when the challenge has hit the attempt cap", async () => {
      const { service } = await buildService({
        twoFactorChallenge: [seededChallenge({ attempts: 5 })],
      })

      await expect(service.verifyChallenge("ch-1", "123456")).rejects.toThrow(
        BadRequestException,
      )
      expect(bcrypt.compare).not.toHaveBeenCalled()
    })

    it("throws when the challenge is already used", async () => {
      const { service } = await buildService({
        twoFactorChallenge: [seededChallenge({ usedAt: new Date() })],
      })

      await expect(service.verifyChallenge("ch-1", "123456")).rejects.toThrow(
        BadRequestException,
      )
    })

    it("throws on a purpose mismatch when an expected purpose is given", async () => {
      const { service } = await buildService({
        twoFactorChallenge: [seededChallenge({ purpose: "ENABLE" })],
      })

      await expect(
        service.verifyChallenge("ch-1", "123456", "LOGIN"),
      ).rejects.toThrow(BadRequestException)
    })

    it("throws on a user mismatch when an expected user is given", async () => {
      const { service } = await buildService({
        twoFactorChallenge: [seededChallenge()],
      })

      await expect(
        service.verifyChallenge("ch-1", "123456", "LOGIN", "other-user"),
      ).rejects.toThrow(BadRequestException)
    })

    it("accepts a recovery code as a LOGIN fallback and claims it once", async () => {
      const { service, prisma } = await buildService({
        twoFactorChallenge: [seededChallenge()],
        recoveryCode: [seededRecoveryCode()],
      })
      ;(bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(false) // OTP mismatch
        .mockResolvedValueOnce(true) // recovery match

      const result = await service.verifyChallenge("ch-1", "Abcdefgh12")

      expect(prisma.recoveryCode.updateMany).toHaveBeenCalledWith({
        where: { id: "rc-1", usedAt: null },
        data: { usedAt: expect.any(Date) },
      })
      expect(prisma.twoFactorChallenge.update).toHaveBeenCalledWith({
        where: { id: "ch-1" },
        data: { usedAt: expect.any(Date) },
      })
      expect(result).toEqual({ userId: "user-1", email: "test@test.com" })
    })

    it("does not reveal recovery codes when none match", async () => {
      const { service, prisma } = await buildService({
        twoFactorChallenge: [seededChallenge()],
        recoveryCode: [seededRecoveryCode()],
      })

      await expect(
        service.verifyChallenge("ch-1", "WRONGCODE"),
      ).rejects.toThrow(BadRequestException)
      expect(prisma.recoveryCode.updateMany).not.toHaveBeenCalled()
      expect(prisma.twoFactorChallenge.update).toHaveBeenCalledWith({
        where: { id: "ch-1" },
        data: { attempts: 1 },
      })
    })

    it("rejects a recovery code when the claim races (updateMany count 0)", async () => {
      const { service, prisma } = await buildService({
        twoFactorChallenge: [seededChallenge()],
        recoveryCode: [seededRecoveryCode()],
      })
      ;(bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
      prisma.recoveryCode.updateMany.mockResolvedValue({ count: 0 })

      await expect(
        service.verifyChallenge("ch-1", "ABCDEFGH12"),
      ).rejects.toThrow(BadRequestException)
    })

    it("does not accept recovery codes for ENABLE challenges", async () => {
      const { service, prisma } = await buildService({
        twoFactorChallenge: [seededChallenge({ purpose: "ENABLE" })],
        recoveryCode: [seededRecoveryCode()],
      })
      ;(bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)

      await expect(
        service.verifyChallenge("ch-1", "ABCDEFGH12", "ENABLE", "user-1"),
      ).rejects.toThrow(BadRequestException)
      expect(prisma.recoveryCode.updateMany).not.toHaveBeenCalled()
    })
  })

  describe("issueRecoveryCodes", () => {
    it("returns 10 plaintext codes and stores their hashes", async () => {
      const { service, prisma } = await buildService()

      const codes = await service.issueRecoveryCodes("user-1")

      expect(codes).toHaveLength(10)
      for (const code of codes) {
        expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/)
      }
      expect(prisma.recoveryCode.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: "user-1", codeHash: "hashed-code" }),
        ]),
      })
      const stored = (prisma.recoveryCode.createMany as jest.Mock).mock.calls[0][0]
        .data
      expect(stored).toHaveLength(10)
    })
  })

  describe("enable", () => {
    it("verifies the ENABLE code, enables 2FA and returns recovery codes", async () => {
      const { service, prisma } = await buildService({
        twoFactorChallenge: [seededChallenge({ purpose: "ENABLE" })],
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)

      const result = await service.enable("user-1", "ch-1", "123456")

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { twoFactorEnabled: true },
      })
      expect(prisma.recoveryCode.createMany).toHaveBeenCalled()
      expect(result.recoveryCodes).toHaveLength(10)
    })
  })

  describe("disable", () => {
    it("verifies the DISABLE code, disables 2FA and deletes recovery codes", async () => {
      const { service, prisma } = await buildService({
        twoFactorChallenge: [seededChallenge({ purpose: "DISABLE" })],
        recoveryCode: [seededRecoveryCode()],
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)

      const result = await service.disable("user-1", "ch-1", "123456")

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { twoFactorEnabled: false },
      })
      expect(prisma.recoveryCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      })
      expect(result).toEqual({ success: true })
    })
  })

  describe("maskEmail", () => {
    it("masks the local part of the email", async () => {
      const { service } = await buildService()
      expect(service.maskEmail("john.doe@example.com")).toBe("joh***@example.com")
    })

    it("handles short local parts", async () => {
      const { service } = await buildService()
      expect(service.maskEmail("ab@example.com")).toBe("ab***@example.com")
    })
  })
})
