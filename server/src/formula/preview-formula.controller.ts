import { Controller, Post, Body } from '@nestjs/common'
import { IsString, IsObject } from 'class-validator'
import { FormulaService } from './formula.service.js'

class PreviewEvaluateDto {
  @IsString()
  formula!: string

  @IsObject()
  variables!: Record<string, number>
}

class PreviewPreviewDto {
  @IsString()
  formula!: string

  @IsObject()
  variables!: Record<string, number>
}

/**
 * Public formula endpoints for the sandbox preview feature.
 * No JWT auth guard — any user can evaluate formulas in preview mode.
 * Uses the same FormulaService as the authenticated controller.
 */
@Controller('public/formula')
export class PreviewFormulaController {
  constructor(private readonly formulaService: FormulaService) {}

  @Post('evaluate')
  evaluate(@Body() dto: PreviewEvaluateDto) {
    return { result: this.formulaService.evaluate(dto.formula, dto.variables) }
  }

  @Post('preview')
  preview(@Body() dto: PreviewPreviewDto) {
    return this.formulaService.preview(dto.formula, dto.variables)
  }
}
