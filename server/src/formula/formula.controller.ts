import { Controller, Post, Body, UseGuards } from '@nestjs/common'
import { IsString, IsObject, IsArray } from 'class-validator'
import { FormulaService } from './formula.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'

class EvaluateDto {
  @IsString()
  formula!: string

  @IsObject()
  variables!: Record<string, number>
}

class PreviewDto {
  @IsString()
  formula!: string

  @IsObject()
  variables!: Record<string, number>
}

class ValidateDto {
  @IsString()
  formula!: string

  @IsArray()
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