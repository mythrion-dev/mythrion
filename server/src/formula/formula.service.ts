import { Injectable, BadRequestException } from '@nestjs/common'
import { create, all } from 'mathjs'

// Limited math scope - only safe operations
const math = create(all)

// Restrict to safe operations only
const allowedFunctions = [
  'floor', 'ceil', 'round', 'max', 'min', 'abs',
  'add', 'subtract', 'multiply', 'divide', 'mod', 'pow', 'sqrt',
]

function transformModSyntax(formula: string): string {
  // Transform mod(key) -> key_mod (a safe variable we'll pre-compute)
  return formula.replace(/mod\(([a-zA-Z_][a-zA-Z0-9_]*)\)/g, (_, key) => `${key}_mod`)
}
const allowedOperators = ['+', '-', '*', '/', '(', ')', '^']

@Injectable()
export class FormulaService {
  /**
   * Evaluate a formula with given variable values.
   * Returns the numeric result.
   * Throws BadRequestException if the expression is invalid.
   */
  evaluate(formula: string, variables: Record<string, number>): number {
    return this.evaluateRaw(transformModSyntax(formula), variables)
  }

  private evaluateRaw(sanitized: string, variables: Record<string, number>): number {
    if (!sanitized || sanitized.trim().length === 0) {
      return 0
    }

    sanitized = sanitized.trim()

    // Validate the expression before executing
    this.validateRaw(sanitized, Object.keys(variables))

    try {
      const scope: Record<string, unknown> = { ...variables }
      const result = math.evaluate(sanitized, scope)

      if (typeof result !== 'number') {
        throw new BadRequestException('Formula must return a number')
      }

      if (!isFinite(result)) {
        throw new BadRequestException('Formula result must be a finite number')
      }

      return Math.round(result * 100) / 100 // Round to 2 decimal places
    } catch (err) {
      if (err instanceof BadRequestException) throw err
      throw new BadRequestException(`Failed to evaluate formula: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate a formula expression without executing it.
   * Checks for syntax errors and unknown functions.
   * Also validates that profile variables are used correctly (not inside mod()).
   */
  validate(formula: string, knownVariables: string[]): void {
    this.validateRaw(transformModSyntax(formula), knownVariables)
  }

  private validateRaw(sanitized: string, knownVariables: string[]): void {
    if (!sanitized || sanitized.trim().length === 0) {
      return
    }

    try {
      const node = math.parse(sanitized)

      // Walk the AST to check for disallowed elements
      this.validateNode(node, knownVariables)
    } catch (err) {
      if (err instanceof BadRequestException) throw err
      throw new BadRequestException(`Invalid formula: ${err instanceof Error ? err.message : 'Syntax error'}`)
    }
  }

  private validateNode(node: unknown, knownVariables: string[]): void {
    if (!node || typeof node !== 'object') return

    const n = node as Record<string, unknown>

    if (n.isSymbolNode) {
      const name = n.name as string
      // Check if variable is known and uses only valid characters
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new BadRequestException(`Invalid variable name: "${name}"`)
      }
      // Only allow known variables (attributes, profiles, mod-suffixed, bonus, penalty, etc.)
      if (!knownVariables.includes(name)) {
        throw new BadRequestException(`Unknown variable: "${name}". Available: ${knownVariables.join(', ')}`)
      }
    }

    if (n.isFunctionNode) {
      const fnName = n.name as string
      if (!allowedFunctions.includes(fnName.toLowerCase())) {
        throw new BadRequestException(`Function "${fnName}" is not allowed. Available: ${allowedFunctions.join(', ')}`)
      }
    }

    if (n.isOperatorNode) {
      const op = n.op as string
      if (!allowedOperators.includes(op) && !['and', 'or', 'not', 'xor', '==', '!=', '<', '>', '<=', '>='].includes(op)) {
        throw new BadRequestException(`Operator "${op}" is not allowed`)
      }
    }

    // Recursively validate child nodes
    if (n.args && Array.isArray(n.args)) {
      for (const arg of n.args) {
        this.validateNode(arg, knownVariables)
      }
    }

    // Validate content (for ParenthesisNode, etc.)
    if (n.content) {
      this.validateNode(n.content, knownVariables)
    }
  }

  /**
   * Generate a human-friendly preview by substituting example values.
   */
  preview(formula: string, variables: Record<string, number>): { expression: string; result: number | null; error?: string } {
    if (!formula || formula.trim().length === 0) {
      return { expression: '', result: null }
    }

    try {
      const transformed = transformModSyntax(formula)
      this.validateRaw(transformed, Object.keys(variables))
      const result = this.evaluateRaw(transformed, variables)
      return { expression: formula, result }
    } catch (err) {
      return {
        expression: formula,
        result: null,
        error: err instanceof Error ? err.message : 'Invalid formula',
      }
    }
  }

  /**
   * Extract all variable names referenced in a formula.
   * This includes both raw attributes and profile names.
   * It ignores function names like mod(), floor(), etc.
   */
  extractVariables(formula: string): string[] {
    if (!formula || formula.trim().length === 0) return []
    const transformed = transformModSyntax(formula)
    const tokens = transformed.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []
    const functionNames = new Set([
      'mod', 'floor', 'ceil', 'round', 'max', 'min', 'abs',
      'add', 'subtract', 'multiply', 'divide', 'pow', 'sqrt',
    ])
    const seen = new Set<string>()
    const vars: string[] = []
    for (const t of tokens) {
      if (!functionNames.has(t) && !seen.has(t)) {
        seen.add(t)
        vars.push(t)
      }
    }
    return vars
  }
}