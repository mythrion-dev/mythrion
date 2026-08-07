import { SetMetadata } from '@nestjs/common'

export const SkipEmailVerificationCheck = () =>
  SetMetadata('skipEmailVerificationCheck', true)
