import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// אוכף את כלל ברזל #7 (RTL-first): רק ms-/me-/ps-/pe- (logical) — אסור
// ml-/mr-/pl-/pr- (physical margin/padding). SPEC.md §8.1.
const here = dirname(fileURLToPath(import.meta.url));
const TARGET_DIR = join(here, '..', 'apps', 'web');
const FORBIDDEN_PATTERN = /\b(?:-|:)?(ml|mr|pl|pr)-(?:\[[^\]]+\]|\d+(?:\.\d+)?|px|auto)\b/g;
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist']);
const EXTENSIONS = new Set(['.ts', '.tsx']);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (EXTENSIONS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

let violations = [];
try {
  for (const file of walk(TARGET_DIR)) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const matches = line.match(FORBIDDEN_PATTERN);
      if (matches) {
        violations.push({ file, line: index + 1, matches });
      }
    });
  }
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('check-rtl: apps/web still does not exist, skipping.');
    process.exit(0);
  }
  throw err;
}

if (violations.length > 0) {
  console.error('check-rtl: physical margin/padding classes found (use ms-/me-/ps-/pe- instead):\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} — ${v.matches.join(', ')}`);
  }
  process.exit(1);
}

console.log('check-rtl: OK — no physical ml-/mr-/pl-/pr- classes found.');
