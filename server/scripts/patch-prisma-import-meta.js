#!/usr/bin/env node
/**
 * Patch Prisma 7 generated client.ts
 *
 * Prisma 7 generates client.ts with `import.meta.url` to set __dirname.
 * The `import.meta.url` syntax causes Node.js 24+ to detect the file as ESM,
 * even when the compiled output is CJS. This breaks CJS require() loading.
 *
 * This script replaces the import.meta.url pattern with CJS-compatible __dirname
 * assignment that works correctly in the compiled CJS output.
 *
 * Uses line-by-line reconstruction to avoid string-replacement boundary bugs.
 */
const fs = require('node:fs')
const path = require('node:path')

const CLIENT_TS_PATH = path.resolve(__dirname, '..', 'src', 'generated', 'prisma', 'client.ts')

/**
 * Patch the TypeScript source after prisma generate.
 * Identifies the import.meta.url block by scanning lines and reconstructs
 * the file with the replacement, avoiding fragile string matching.
 */
function patchSource() {
  if (!fs.existsSync(CLIENT_TS_PATH)) {
    console.error(`[patch-prisma] ERROR: ${CLIENT_TS_PATH} not found`)
    return false
  }

  const content = fs.readFileSync(CLIENT_TS_PATH, 'utf-8')
  const lines = content.split(/\r?\n/)

  // Find the line containing import.meta.url
  const metaIdx = lines.findIndex(l => l.includes("import.meta.url"))
  if (metaIdx === -1) {
    console.error('[patch-prisma] WARNING: import.meta.url not found — skipping')
    return false
  }

  // Lines we expect to see just before import.meta.url (going backwards):
  //   import { fileURLToPath } from 'node:url'
  //   import * as path from 'node:path'
  //   import * as process from 'node:process'
  // Verify and find the start of the block
  let blockStart = metaIdx
  for (let i = metaIdx - 1; i >= Math.max(0, metaIdx - 5); i--) {
    const stripped = lines[i].trim()
    if (
      stripped.startsWith("import { fileURLToPath } from 'node:url'") ||
      stripped.startsWith('import { fileURLToPath } from "node:url"') ||
      stripped.startsWith("import * as path from 'node:path'") ||
      stripped.startsWith('import * as path from "node:path"') ||
      stripped.startsWith("import * as process from 'node:process'") ||
      stripped.startsWith('import * as process from "node:process"') ||
      stripped === ''
    ) {
      if (stripped !== '') blockStart = i
    } else {
      break
    }
  }

  // Build replacement lines (1 line before the imports can be a blank line, keep it)
  const REPLACEMENT = [
    '// Note: __dirname is set from the compiled CJS output;',
    '// import.meta.url removed for CJS compatibility with Node.js 24+.',
    "globalThis['__dirname'] = __dirname",
  ]

  // Reconstruct the file: keep lines before blockStart, add replacement, skip old lines
  const before = lines.slice(0, blockStart)
  const after = lines.slice(metaIdx + 1)

  const result = [...before, ...REPLACEMENT, ...after].join('\n')

  fs.writeFileSync(CLIENT_TS_PATH, result, 'utf-8')
  console.log('[patch-prisma] Patched client.ts — removed import.meta.url block')
  return true
}

if (!patchSource()) {
  process.exit(1)
}
