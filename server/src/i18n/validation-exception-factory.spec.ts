import { BadRequestException } from '@nestjs/common'
import type { ValidationError } from '@nestjs/common'
import { createI18nValidationExceptionFactory } from './validation-exception-factory'

jest.mock('nestjs-i18n', () => ({
  I18nContext: { current: jest.fn() },
}))

import { I18nContext } from 'nestjs-i18n'

const mockCurrent = I18nContext.current as jest.Mock
const translate = jest.fn((key: string) => `tr(${key})`)
const context = {
  lang: 'pt-BR',
  service: { translate },
}

describe('createI18nValidationExceptionFactory', () => {
  let factory: ReturnType<typeof createI18nValidationExceptionFactory>

  beforeEach(() => {
    factory = createI18nValidationExceptionFactory()
    translate.mockImplementation((key: string) => `tr(${key})`)
  })

  afterEach(() => {
    mockCurrent.mockReset()
    translate.mockClear()
  })

  it('passes raw messages through when no i18n context is active', () => {
    mockCurrent.mockReturnValue(undefined)

    const exception = factory([
      { property: 'email', constraints: { isEmail: 'email must be an email' } },
    ] as ValidationError[])

    expect(exception).toBeInstanceOf(BadRequestException)
    expect(exception.getResponse()).toEqual({
      statusCode: 400,
      message: ['email must be an email'],
      error: 'Bad Request',
    })
    expect(translate).not.toHaveBeenCalled()
  })

  it('translates key|json constraint messages through the active context', () => {
    mockCurrent.mockReturnValue(context)

    const exception = factory([
      {
        property: 'status',
        value: 'x',
        constraints: { isIn: 'validation.isIn|{"value":"x","constraints":[["a","b"]]}' },
      },
    ] as ValidationError[])

    expect(translate).toHaveBeenCalledWith('validation.isIn', {
      lang: 'pt-BR',
      args: {
        property: 'status',
        value: 'x',
        constraints: [['a', 'b']],
        allowedValues: 'a, b',
      },
    })
    expect((exception.getResponse() as { message: string[] }).message).toEqual(['tr(validation.isIn)'])
  })

  it('leaves messages without the key| separator untouched', () => {
    mockCurrent.mockReturnValue(context)

    const exception = factory([
      { property: 'email', constraints: { isEmail: 'plain message' } },
    ] as ValidationError[])

    expect(translate).not.toHaveBeenCalled()
    expect((exception.getResponse() as { message: string[] }).message).toEqual(['plain message'])
  })

  it('flattens nested validation children', () => {
    mockCurrent.mockReturnValue(context)

    const exception = factory([
      {
        property: 'profile',
        constraints: { isObject: 'profile|{"constraints":["x"]}' },
        children: [
          {
            property: 'bio',
            constraints: { maxLength: 'validation.maxLength|{"constraints":["y"]}' },
            children: [
              { property: 'z', constraints: { isString: 'validation.isString|{"constraints":["z"]}' } },
            ],
          },
        ],
      },
    ] as ValidationError[])

    expect((exception.getResponse() as { message: string[] }).message).toEqual([
      'tr(profile)',
      'tr(validation.maxLength)',
      'tr(validation.isString)',
    ])
  })

  it('derives allowed values from an array first constraint', () => {
    mockCurrent.mockReturnValue(context)

    factory([
      {
        property: 'status',
        constraints: { isIn: 'validation.isIn|{"constraints":[["active","inactive"]]}' },
      },
    ] as ValidationError[])

    expect(translate).toHaveBeenCalledWith(
      'validation.isIn',
      expect.objectContaining({
        args: expect.objectContaining({ allowedValues: 'active, inactive' }),
      }),
    )
  })

  it('derives allowed values from an object constraint', () => {
    mockCurrent.mockReturnValue(context)

    factory([
      {
        property: 'status',
        constraints: { isIn: 'validation.isIn|{"constraints":[{"1":"a","2":"b"}]}' },
      },
    ] as ValidationError[])

    expect(translate).toHaveBeenCalledWith(
      'validation.isIn',
      expect.objectContaining({
        args: expect.objectContaining({ allowedValues: 'a, b' }),
      }),
    )
  })

  it('forwards extra parsed args to the translator', () => {
    mockCurrent.mockReturnValue(context)

    factory([
      {
        property: 'count',
        constraints: { min: 'validation.min|{"min":3,"constraints":["3"]}' },
      },
    ] as ValidationError[])

    expect(translate).toHaveBeenCalledWith(
      'validation.min',
      expect.objectContaining({
        args: expect.objectContaining({ min: 3 }),
      }),
    )
  })

  it('falls back to error constraints when the JSON payload is unparsable', () => {
    mockCurrent.mockReturnValue(context)

    const exception = factory([
      {
        property: 'email',
        value: 'x',
        constraints: { isEmail: 'validation.isEmail|not-json' },
      },
    ] as ValidationError[])

    expect(translate).toHaveBeenCalledWith('validation.isEmail', {
      lang: 'pt-BR',
      args: {
        property: 'email',
        value: 'x',
        constraints: ['validation.isEmail|not-json'],
        allowedValues: undefined,
      },
    })
    expect((exception.getResponse() as { message: string[] }).message).toEqual(['tr(validation.isEmail)'])
  })
})
