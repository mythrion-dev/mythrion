import { BadRequestException, type ValidationError } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';

function flattenErrors(errors: ValidationError[]): ValidationError[] {
  const flat: ValidationError[] = [];
  for (const error of errors) {
    flat.push(error);
    if (error.children?.length) flat.push(...flattenErrors(error.children));
  }
  return flat;
}

function deriveAllowedValues(constraints: unknown[]): string | undefined {
  const first = constraints[0];
  if (Array.isArray(first)) return first.join(', ');
  if (first && typeof first === 'object') return Object.values(first as Record<string, unknown>).join(', ');
  return undefined;
}

function translateMessage(raw: string, error: ValidationError, context: I18nContext): string {
  const separator = raw.indexOf('|');
  if (separator === -1) return raw;
  const key = raw.slice(0, separator);
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw.slice(separator + 1));
  } catch {
    parsed = {};
  }
  const rawConstraints = (parsed.constraints as unknown) ?? error.constraints ?? {};
  const constraints = Array.isArray(rawConstraints)
    ? rawConstraints
    : Object.values(rawConstraints as Record<string, unknown>);
  return context.service.translate(key, {
    lang: context.lang,
    args: {
      property: error.property,
      value: error.value,
      ...parsed,
      constraints,
      allowedValues: parsed.allowedValues ?? deriveAllowedValues(constraints),
    },
  });
}

/**
 * Replaces the default ValidationPipe factory so `i18nValidationMessage` keys
 * are translated per-request while preserving the standard
 * `{ statusCode, message: string[], error }` 400 body shape that the client
 * parses (`body.message[0]`). Keys that do not follow the `key|json` format are
 * passed through unchanged.
 */
export function createI18nValidationExceptionFactory() {
  return (errors: ValidationError[]) => {
    const context = I18nContext.current();
    const messages = flattenErrors(errors).flatMap((error) => {
      const constraints = error.constraints ? Object.values(error.constraints) : [];
      if (!context) return constraints;
      return constraints.map((raw) => translateMessage(raw, error, context));
    });
    return new BadRequestException(messages);
  };
}
