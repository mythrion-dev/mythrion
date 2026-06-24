import { Controller, Post, Body, UseGuards } from '@nestjs/common'
import { FormulaService } from './formula.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'

class EvaluateDto {
  formula!: string
  variables!: Record<string, number>
}

class PreviewDto {
  formula!: string
  variables!: Record<string, number>
}

class ValidateDto {
  formula!: string
  variables!: string[]
}

@Controller('formula')
@UseGuards(JwtAuthGuard)
export class FormulaController {
  constructor(private readonly formulaService: FormulaService) {}

  @Post('evaluate')
  evaluate(@Body() dto: EvaluateDto) {
    return { result: this.formulaService.evaluate(dto.formula, dto.variables) }
  }

  @Post('preview')
  preview(@Body() dto: PreviewDto) {
    return this.formulaService.preview(dto.formula, dto.variables)
  }

  @Post('validate')
  validate(@Body() dto: ValidateDto) {
    this.formulaService.validate(dto.formula, dto.variables)
    return { valid: true }
  }
}