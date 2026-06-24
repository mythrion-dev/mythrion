import { Module } from '@nestjs/common'
import { FormulaService } from './formula.service.js'
import { FormulaController } from './formula.controller.js'
import { JwtModule } from '@nestjs/jwt'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [FormulaController],
  providers: [FormulaService],
  exports: [FormulaService],
})
export class FormulaModule {}