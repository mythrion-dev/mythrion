import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { I18nService } from 'nestjs-i18n';

type Catalog = Record<string, string>;

let cached: Record<string, Catalog> | null = null;

function catalogs(): Record<string, Catalog> {
  if (cached) return cached;
  const dir = join(__dirname, 'en');
  cached = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const namespace = file.slice(0, -'.json'.length);
    cached[namespace] = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  }
  return cached;
}

function lookup(translations: Record<string, Catalog>, key: string): string | undefined {
  const separator = key.indexOf(':');
  if (separator !== -1) {
    const namespace = key.slice(0, separator);
    const path = key.slice(separator + 1);
    const value = translations[namespace]?.[path];
    return typeof value === 'string' ? value : undefined;
  }
  const keySeparator = key.indexOf('.');
  if (keySeparator !== -1) {
    const namespace = key.slice(0, keySeparator);
    const path = key.slice(keySeparator + 1);
    const value = translations[namespace]?.[path];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

function interpolate(template: string, args: Record<string, unknown>): string {
  return template.replace(/\{([\w.]+)\}/g, (match, path: string) => {
    const value = path.split('.').reduce<unknown>((acc, part) => {
      if (acc === null || acc === undefined) return undefined;
      if (typeof acc !== 'object') return undefined;
      return (acc as Record<string, unknown>)[part];
    }, args);
    return value === null || value === undefined ? match : String(value);
  });
}

/**
 * Test double backed by the real `en/*.json` catalogs. The English values are
 * byte-identical to the original hardcoded strings, so existing assertions on
 * `{ message: '...' }` keep passing once services translate through I18nService.
 */
export function createI18nServiceMock(): I18nService {
  const translations = catalogs();
  const translate = (key: string, options?: { args?: Record<string, unknown>; lang?: string }) => {
    const template = lookup(translations, key);
    if (template === undefined) return key;
    if (!options?.args) return template;
    return interpolate(template, options.args);
  };
  return {
    t: translate,
    translate,
    getSupportedLanguages: () => ['en', 'pt-BR'],
  } as unknown as I18nService;
}
