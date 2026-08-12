/**
 * Covers the `typeof X !== "undefined" ? X : Object` circular-import guards
 * that tsc emits inside `design:paramtypes` metadata arrays for every
 * decorated parameter. With `emitDecoratorMetadata`, those guards evaluate at
 * MODULE LOAD time, not when a method is called, so an ordinary unit test can
 * only ever exercise the "import defined" path. Mocking each type module to an
 * empty object makes the imports resolve to `undefined`, exercising the
 * alternate path. Coverage aggregates with auth.controller.spec.ts.
 */
jest.mock('./auth.service.js', () => ({}))
jest.mock('./language.service.js', () => ({}))
jest.mock('./permission.service.js', () => ({}))
jest.mock('./dto/register.dto.js', () => ({}))
jest.mock('./dto/login.dto.js', () => ({}))
jest.mock('./dto/onboarding.dto.js', () => ({}))
jest.mock('./dto/language.dto.js', () => ({}))
jest.mock('./dto/two-factor.dto.js', () => ({}))

import { AuthController } from './auth.controller.js'

describe('AuthController module-load guards', () => {
  it('loads the controller when type imports are undefined', () => {
    expect(typeof AuthController).toBe('function')
  })
})
