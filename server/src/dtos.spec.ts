import 'reflect-metadata'

jest.mock('./generated/prisma/client', () => {
  const enums = {
    BookVisibility: { PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE', UNLISTED: 'UNLISTED' },
  }
  return new Proxy(
    { PrismaClient: class {}, ...enums },
    {
      get(target, prop) {
        if (prop in target) return target[prop]
        return {}
      },
    },
  )
})

import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { CreateAdventureDto } from './adventure/dto/create-adventure.dto.js'
import { UpdateAdventureDto } from './adventure/dto/update-adventure.dto.js'
import { ChangeEmailDto } from './auth/dto/change-email.dto.js'
import { ChangePasswordDto } from './auth/dto/change-password.dto.js'
import { ForgotPasswordDto } from './auth/dto/forgot-password.dto.js'
import { LanguageDto, SUPPORTED_LANGUAGES } from './auth/dto/language.dto.js'
import { LoginDto } from './auth/dto/login.dto.js'
import { OnboardingDto } from './auth/dto/onboarding.dto.js'
import { RegisterDto } from './auth/dto/register.dto.js'
import { ResendVerificationDto } from './auth/dto/resend-verification.dto.js'
import { ResetPasswordDto } from './auth/dto/reset-password.dto.js'
import {
  ResendTwoFactorDto,
  TwoFactorConfirmDto,
  TwoFactorSendDto,
  VerifyTwoFactorDto,
} from './auth/dto/two-factor.dto.js'
import { VerifyEmailDto } from './auth/dto/verify-email.dto.js'
import { CreateBookDto } from './book/dto/create-book.dto.js'
import { UpdateBookDto } from './book/dto/update-book.dto.js'
import { CreateCharacterFromCampaignDto } from './character-sheet/dto/create-character-from-campaign.dto.js'
import { CreateCharacterSheetDto } from './character-sheet/dto/create-character-sheet.dto.js'
import {
  AttributeValueDto,
  CoreResourceValueDto,
  FieldValueDto,
  ResistanceComponentValueDto,
  ResistanceValueDto,
  SkillProfileValueDto,
  SkillValueDto,
  UpdateCharacterSheetDto,
} from './character-sheet/dto/update-character-sheet.dto.js'
import { CreateFolderDto } from './notebook/dto/create-folder.dto.js'
import { CreatePageDto } from './notebook/dto/create-page.dto.js'
import { UpdateFolderDto } from './notebook/dto/update-folder.dto.js'
import { UpdatePageDto } from './notebook/dto/update-page.dto.js'
import { CreateTemplateDto } from './template/dto/create-template.dto.js'
import { UpdateTemplateDto } from './template/dto/update-template.dto.js'

const run = (cls: any, data: Record<string, unknown>) => {
  return validate(plainToInstance(cls, data))
}

describe('DTO validation', () => {
  describe('CreateAdventureDto', () => {
    it('accepts a valid payload', async () => {
      const errors = await run(CreateAdventureDto, {
        name: 'Quest',
        campaign: 'Camp',
        maxPlayers: 4,
      })
      expect(errors).toHaveLength(0)
    })

    it('accepts all optional fields', async () => {
      const errors = await run(CreateAdventureDto, {
        name: 'Quest',
        campaign: 'Camp',
        synopsis: 's',
        maxPlayers: 5,
        isPublic: true,
        sessionWeekday: 'Monday',
        sessionTime: '19:00',
        sessionType: 'ONLINE',
        templateId: 't1',
      })
      expect(errors).toHaveLength(0)
    })

    it('rejects invalid values', async () => {
      const errors = await run(CreateAdventureDto, {
        name: 123,
        campaign: 'Camp',
        maxPlayers: 0,
        sessionWeekday: 'Funday',
        sessionType: 'REMOTE',
      })
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('UpdateAdventureDto', () => {
    it('accepts an empty payload', async () => {
      expect(await run(UpdateAdventureDto, {})).toHaveLength(0)
    })

    it('accepts a partial payload', async () => {
      const errors = await run(UpdateAdventureDto, {
        name: 'Quest',
        maxPlayers: 3,
        sessionType: 'IN_PERSON',
        isPublic: false,
      })
      expect(errors).toHaveLength(0)
    })

    it('rejects invalid values', async () => {
      const errors = await run(UpdateAdventureDto, {
        maxPlayers: 9,
        sessionWeekday: 'Nope',
      })
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('ChangeEmailDto', () => {
    it('accepts a valid email', async () => {
      expect(await run(ChangeEmailDto, { email: 'a@b.com' })).toHaveLength(0)
    })

    it('rejects an invalid email', async () => {
      expect((await run(ChangeEmailDto, { email: 'not-an-email' })).length).toBeGreaterThan(0)
    })
  })

  describe('ChangePasswordDto', () => {
    it('accepts a valid payload', async () => {
      const errors = await run(ChangePasswordDto, {
        currentPassword: 'Old!123',
        newPassword: 'New!1234',
        logoutOtherDevices: true,
        currentRefreshToken: 'tok',
      })
      expect(errors).toHaveLength(0)
    })

    it('rejects a weak new password', async () => {
      const errors = await run(ChangePasswordDto, {
        currentPassword: 'Old!123',
        newPassword: 'weak',
      })
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('ForgotPasswordDto', () => {
    it('accepts a valid email', async () => {
      expect(await run(ForgotPasswordDto, { email: 'a@b.com' })).toHaveLength(0)
    })

    it('rejects an invalid email', async () => {
      expect((await run(ForgotPasswordDto, { email: 'bad' })).length).toBeGreaterThan(0)
    })
  })

  describe('LanguageDto', () => {
    it.each(SUPPORTED_LANGUAGES)('accepts the supported language %s', async (lang) => {
      expect(await run(LanguageDto, { language: lang })).toHaveLength(0)
    })

    it('rejects an unsupported language', async () => {
      expect((await run(LanguageDto, { language: 'fr' })).length).toBeGreaterThan(0)
    })
  })

  describe('LoginDto', () => {
    it('accepts a valid payload', async () => {
      const errors = await run(LoginDto, { email: 'a@b.com', password: '12345678' })
      expect(errors).toHaveLength(0)
    })

    it('rejects a short password', async () => {
      const errors = await run(LoginDto, { email: 'a@b.com', password: 'short' })
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('OnboardingDto', () => {
    it('accepts a valid display name', async () => {
      expect(await run(OnboardingDto, { displayName: 'Lucas' })).toHaveLength(0)
    })

    it('rejects a too-long or non-string display name', async () => {
      expect((await run(OnboardingDto, { displayName: 'x'.repeat(51) })).length).toBeGreaterThan(0)
      expect((await run(OnboardingDto, { displayName: 123 })).length).toBeGreaterThan(0)
    })
  })

  describe('RegisterDto', () => {
    it('accepts a valid payload with accepted terms', async () => {
      const errors = await run(RegisterDto, {
        email: 'a@b.com',
        password: '12345678',
        displayName: 'L',
        acceptTerms: true,
      })
      expect(errors).toHaveLength(0)
    })

    it('rejects when terms are not accepted', async () => {
      const errors = await run(RegisterDto, {
        email: 'a@b.com',
        password: '12345678',
        acceptTerms: false,
      })
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('ResendVerificationDto', () => {
    it('accepts a valid email', async () => {
      expect(await run(ResendVerificationDto, { email: 'a@b.com' })).toHaveLength(0)
    })

    it('rejects an invalid email', async () => {
      expect((await run(ResendVerificationDto, { email: 'bad' })).length).toBeGreaterThan(0)
    })
  })

  describe('ResetPasswordDto', () => {
    it('accepts a valid payload', async () => {
      const errors = await run(ResetPasswordDto, {
        token: 'abc',
        password: 'Str0ng!pass',
      })
      expect(errors).toHaveLength(0)
    })

    it('rejects an empty token and a weak password', async () => {
      const errors = await run(ResetPasswordDto, { token: '', password: 'weak' })
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('TwoFactorSendDto', () => {
    it('accepts a valid purpose', async () => {
      expect(await run(TwoFactorSendDto, { purpose: 'ENABLE' })).toHaveLength(0)
    })

    it('rejects an unknown purpose', async () => {
      expect((await run(TwoFactorSendDto, { purpose: 'OTHER' })).length).toBeGreaterThan(0)
    })
  })

  describe('TwoFactorConfirmDto', () => {
    it('accepts a valid payload', async () => {
      const errors = await run(TwoFactorConfirmDto, {
        purpose: 'DISABLE',
        twoFactorId: 'id',
        code: '123456',
      })
      expect(errors).toHaveLength(0)
    })

    it('rejects a malformed code', async () => {
      const errors = await run(TwoFactorConfirmDto, {
        purpose: 'DISABLE',
        twoFactorId: 'id',
        code: '123',
      })
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('VerifyTwoFactorDto', () => {
    it('accepts a valid code', async () => {
      expect(
        await run(VerifyTwoFactorDto, { twoFactorId: 'id', code: 'ABCDEFGHIJ' }),
      ).toHaveLength(0)
    })

    it('rejects a malformed code', async () => {
      expect(
        (await run(VerifyTwoFactorDto, { twoFactorId: 'id', code: '123' })).length,
      ).toBeGreaterThan(0)
    })
  })

  describe('ResendTwoFactorDto', () => {
    it('accepts a valid twoFactorId', async () => {
      expect(await run(ResendTwoFactorDto, { twoFactorId: 'id' })).toHaveLength(0)
    })

    it('rejects a non-string id', async () => {
      expect((await run(ResendTwoFactorDto, { twoFactorId: 5 })).length).toBeGreaterThan(0)
    })
  })

  describe('VerifyEmailDto', () => {
    it('accepts a token', async () => {
      expect(await run(VerifyEmailDto, { token: 'abc' })).toHaveLength(0)
    })

    it('rejects an empty or non-string token', async () => {
      expect((await run(VerifyEmailDto, { token: '' })).length).toBeGreaterThan(0)
      expect((await run(VerifyEmailDto, { token: 5 })).length).toBeGreaterThan(0)
    })
  })

  describe('CreateBookDto', () => {
    it('accepts a valid payload', async () => {
      expect(await run(CreateBookDto, { name: 'Book', visibility: 'PUBLIC' })).toHaveLength(0)
    })

    it('accepts a payload without visibility', async () => {
      expect(await run(CreateBookDto, { name: 'Book' })).toHaveLength(0)
    })

    it('rejects an invalid name and visibility', async () => {
      expect(
        (await run(CreateBookDto, { name: 5, visibility: 'NOPE' })).length,
      ).toBeGreaterThan(0)
    })
  })

  describe('UpdateBookDto', () => {
    it('accepts an empty or valid payload', async () => {
      expect(await run(UpdateBookDto, {})).toHaveLength(0)
      expect(await run(UpdateBookDto, { visibility: 'PRIVATE' })).toHaveLength(0)
    })

    it('rejects an invalid visibility', async () => {
      expect((await run(UpdateBookDto, { visibility: 'NOPE' })).length).toBeGreaterThan(0)
    })
  })

  describe('CreateCharacterFromCampaignDto', () => {
    it('accepts a valid payload', async () => {
      const errors = await run(CreateCharacterFromCampaignDto, {
        characterName: 'Gandalf',
        adventureId: 'adv1',
        playerName: 'P',
        level: 3,
      })
      expect(errors).toHaveLength(0)
    })

    it('rejects a level below 1', async () => {
      const errors = await run(CreateCharacterFromCampaignDto, {
        characterName: 'G',
        adventureId: 'a',
        level: 0,
      })
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('CreateCharacterSheetDto', () => {
    it('accepts a valid payload', async () => {
      const errors = await run(CreateCharacterSheetDto, {
        characterName: 'Frodo',
        playerName: 'P',
        level: 2,
        templateId: 't1',
        adventureId: 'a1',
      })
      expect(errors).toHaveLength(0)
    })

    it('rejects a level below 1', async () => {
      const errors = await run(CreateCharacterSheetDto, {
        characterName: 'F',
        templateId: 't1',
        level: 0,
      })
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('UpdateCharacterSheetDto (and nested value DTOs)', () => {
    const validPayload = {
      characterName: 'X',
      playerName: 'P',
      level: 5,
      hpActual: 10,
      hpMax: 20,
      hpNotes: 'n',
      values: [{ attributeId: 'a', value: '10' }],
      fieldValues: [{ templateFieldId: 'f', value: 'x' }],
      skillValues: [{ skillId: 's', value: '1', selectedAttributeId: 'a' }],
      skillProfileValues: [{ skillId: 's', profileId: 'p', optionId: 'o' }],
      coreResourceValues: [{ coreResourceId: 'c', current: 1, maximum: 2, notes: 'n' }],
      acValues: [{ fieldId: 'f', value: '10' }],
      acAttributeValues: [{ acAttributeModifierId: 'm', selectedAttributeId: 'a' }],
      resistanceValues: [{ resistanceId: 'r', manualValue: 'x' }],
      resistanceComponentValues: [{ componentId: 'c', value: 'x' }],
    }

    it('accepts a fully populated payload', async () => {
      expect(await run(UpdateCharacterSheetDto, validPayload)).toHaveLength(0)
    })

    it('accepts an empty payload', async () => {
      expect(await run(UpdateCharacterSheetDto, {})).toHaveLength(0)
    })

    it('rejects a nested value missing its required field', async () => {
      const errors = await run(UpdateCharacterSheetDto, {
        values: [{ attributeId: 'a' }],
      })
      expect(errors.length).toBeGreaterThan(0)
    })

    it('rejects a non-numeric level', async () => {
      const errors = await run(UpdateCharacterSheetDto, { level: 'x' })
      expect(errors.length).toBeGreaterThan(0)
    })

    it('nested value DTOs validate individually', async () => {
      expect(await run(AttributeValueDto, { attributeId: 'a', value: 'v' })).toHaveLength(0)
      expect((await run(AttributeValueDto, { attributeId: 'a' })).length).toBeGreaterThan(0)
      expect(await run(FieldValueDto, { templateFieldId: 'f', value: 'v' })).toHaveLength(0)
      expect(await run(SkillValueDto, { skillId: 's', value: 'v' })).toHaveLength(0)
      expect(await run(SkillProfileValueDto, { skillId: 's', profileId: 'p' })).toHaveLength(0)
      expect(await run(CoreResourceValueDto, { coreResourceId: 'c', current: 1 })).toHaveLength(0)
      expect(await run(ResistanceValueDto, { resistanceId: 'r' })).toHaveLength(0)
      expect(
        await run(ResistanceComponentValueDto, { componentId: 'c', value: 'v' }),
      ).toHaveLength(0)
    })
  })

  describe('Notebook DTOs', () => {
    it('CreateFolderDto', async () => {
      expect(await run(CreateFolderDto, { name: 'F' })).toHaveLength(0)
      expect((await run(CreateFolderDto, { name: 5 })).length).toBeGreaterThan(0)
    })

    it('CreatePageDto', async () => {
      expect(await run(CreatePageDto, { title: 'T', folderId: 'f1' })).toHaveLength(0)
      expect((await run(CreatePageDto, { title: 5 })).length).toBeGreaterThan(0)
    })

    it('UpdateFolderDto', async () => {
      expect(await run(UpdateFolderDto, { name: 'F', sortOrder: 2 })).toHaveLength(0)
      expect(await run(UpdateFolderDto, {})).toHaveLength(0)
      expect((await run(UpdateFolderDto, { sortOrder: 'x' })).length).toBeGreaterThan(0)
    })

    it('UpdatePageDto', async () => {
      expect(
        await run(UpdatePageDto, { title: 'T', content: 'C', folderId: null, sortOrder: 1 }),
      ).toHaveLength(0)
      expect(await run(UpdatePageDto, {})).toHaveLength(0)
      expect((await run(UpdatePageDto, { sortOrder: 'x' })).length).toBeGreaterThan(0)
    })
  })

  describe('CreateTemplateDto', () => {
    const validPayload = {
      name: 'T',
      description: 'd',
      templateFields: [{ key: 'k', label: 'l' }],
      skills: [
        {
          name: 's',
          description: 'd',
          attributeId: 'a',
          allowedAttributeIds: ['a1'],
          defaultAttributeId: 'a',
        },
      ],
      attributes: [{ key: 'str', name: 'Strength' }],
      skillModifierProfiles: [
        { name: 'p', targetMode: 'mode', targetSkillIds: ['s'], options: [{ label: 'Opt', value: 1 }] },
      ],
      coreResources: [
        {
          displayName: 'HP',
          slug: 'hp',
          enabled: true,
          editableByPlayer: true,
          showNotes: true,
          color: '#fff',
        },
      ],
      armorClasses: [
        {
          enabled: true,
          name: 'AC',
          attributeModifierIds: ['m'],
          attributeModifiers: [{ attributeId: 'a', allowPlayerSelection: true, defaultAttributeId: 'a' }],
          fields: [
            { name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: 'd' },
          ],
        },
      ],
      attributeModifiersEnabled: true,
      attributeModifierFormula: 'x',
      skillFormula: 'y',
      characterSections: [{ name: 'Section' }],
      resistances: [
        {
          name: 'R',
          calculationType: 'c',
          components: [{ name: 'c', editableByPlayer: true, defaultValue: '0' }],
          attributeModifiers: [{ attributeId: 'a', enabled: true }],
        },
      ],
      isPublic: true,
    }

    it('accepts a fully populated payload', async () => {
      expect(await run(CreateTemplateDto, validPayload)).toHaveLength(0)
    })

    it('rejects a payload without attributes', async () => {
      const errors = await run(CreateTemplateDto, { name: 'T' })
      expect(errors.length).toBeGreaterThan(0)
    })

    it('rejects a profile with empty options', async () => {
      const errors = await run(CreateTemplateDto, {
        name: 'T',
        attributes: [{ key: 'str', name: 'Strength' }],
        skillModifierProfiles: [{ name: 'p', options: [] }],
      })
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('UpdateTemplateDto', () => {
    const validPayload = {
      name: 'T',
      description: 'd',
      attributes: [{ key: 'k', name: 'n' }],
      templateFields: [{ key: 'k', label: 'l' }],
      skills: [{ name: 's', allowedAttributeIds: ['a'] }],
      skillModifierProfiles: [{ name: 'p', options: [{ label: 'O', value: 1 }] }],
      coreResources: [{ slug: 'hp', color: '#000' }],
      armorClasses: [
        {
          enabled: true,
          attributeModifierIds: ['m'],
          attributeModifiers: [{ attributeId: 'a' }],
          fields: [{ key: 'base' }],
        },
      ],
      attributeModifiersEnabled: false,
      attributeModifierFormula: 'x',
      skillFormula: 'y',
      characterSections: [{ name: 'Sec' }],
      resistances: [
        { name: 'R', components: [{ name: 'c' }], attributeModifiers: [{ attributeId: 'a' }] },
      ],
      isPublic: false,
    }

    it('accepts a fully populated payload', async () => {
      expect(await run(UpdateTemplateDto, validPayload)).toHaveLength(0)
    })

    it('accepts an empty payload', async () => {
      expect(await run(UpdateTemplateDto, {})).toHaveLength(0)
    })

    it('rejects a profile with empty options', async () => {
      const errors = await run(UpdateTemplateDto, {
        skillModifierProfiles: [{ name: 'p', options: [] }],
      })
      expect(errors.length).toBeGreaterThan(0)
    })
  })
})
