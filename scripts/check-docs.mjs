import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * Documentation reference checker.
 *
 * Keeps the doc set honest as the code moves: every file reference in `docs/*.md`, `docs/wiki/*.md`
 * and the root `README.md` must resolve to a real repository file.
 *
 * A reference is anything that looks like a file path: a markdown link target, or an inline code span
 * with a path-like shape (contains `/` or `\`, or carries a source extension). References that carry
 * glob (`*`), brace (`{a,b}`) or placeholder (`<...>`) syntax are skipped — they describe shapes, not
 * files.
 *
 * Resolution is intentionally forgiving about *where* in the tree a short reference lives: docs
 * frequently name a module by its path inside its package (`engine/visual.ts`). We therefore resolve a
 * reference if any file in the repository ends with the referenced path segments, or if the reference
 * resolves directly next to the doc or at the repo root.
 *
 * Invoked by `pnpm docs:check`.
 */

const ROOT = resolve(import.meta.dirname, '..');
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  'build',
  '.next',
  'coverage',
  '.cache',
]);
const REF_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.js',
  '.jsx',
  '.json',
  '.jsonc',
  '.css',
  '.wgsl',
  '.md',
  '.rs',
  '.toml',
  '.yaml',
  '.yml',
  '.ps1',
  '.sh',
];

/** Build a set of every file path in the repo, relative and lowercased, for suffix matching. */
function indexRepoFiles() {
  const paths = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (IGNORE_DIRS.has(name)) continue;
      const abs = join(dir, name);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(abs);
      else if (st.isFile()) paths.push(relative(ROOT, abs).split(/[\\/]/).join('/').toLowerCase());
    }
  };
  walk(ROOT);
  return paths;
}

const REPO_FILES = indexRepoFiles();
const REPO_FILE_SET = new Set(REPO_FILES);

/** True when `needle` (a lowercased slash path) is the tail of some repo file path. */
function matchesTail(needle) {
  const tail = `/${needle}`;
  return REPO_FILES.some((p) => p === needle || p.endsWith(tail));
}

function cleanRef(raw) {
  return raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/[),.;:'"`]+$/g, '')
    .replace(/#.*$/, '')
    .replace(/^\.\//, '')
    .trim();
}

function isPathLike(ref) {
  if (!ref) return false;
  if (ref.startsWith('http://') || ref.startsWith('https://')) return false;
  if (ref.startsWith('#') || ref.startsWith('/')) return false;
  if (ref.startsWith('node:') || ref.startsWith('@')) return false;
  if (ref.includes('*') || ref.includes('{') || ref.includes('<') || ref.includes('>'))
    return false;
  if (ref.includes(' ')) return false;
  if (ref.startsWith('path/to/')) return false; // placeholder
  // Must end in a real extension, or be an explicit directory path that exists.
  const cleaned = cleanRef(ref).toLowerCase();
  // A bare extension such as `.js` or `.md` is prose, not a path.
  if (REF_EXTENSIONS.includes(cleaned)) return false;
  if (cleaned.endsWith('/')) return existsSync(resolve(ROOT, cleaned));
  return REF_EXTENSIONS.some((ext) => cleaned.endsWith(ext));
}

function isIgnored(ref) {
  return cleanRef(ref)
    .toLowerCase()
    .split('/')
    .some((part) => IGNORE_DIRS.has(part));
}

function extractRefs(text) {
  const refs = new Set();
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const ref = m[1];
    if (isPathLike(ref)) refs.add(ref);
  }
  for (const m of text.matchAll(/\]\(([^)\n]+)\)/g)) {
    const ref = m[1];
    if (isPathLike(ref)) refs.add(ref);
  }
  return refs;
}

function listDocs() {
  const files = [];
  const docsDir = join(ROOT, 'docs');
  if (existsSync(docsDir)) {
    for (const name of readdirSync(docsDir)) {
      if (name.endsWith('.md')) files.push(join('docs', name));
    }
    const wiki = join(docsDir, 'wiki');
    if (existsSync(wiki)) {
      for (const name of readdirSync(wiki)) {
        if (name.endsWith('.md')) files.push(join('docs', 'wiki', name));
      }
    }
  }
  if (existsSync(join(ROOT, 'README.md'))) files.push('README.md');
  return files;
}

function resolves(ref, docDir) {
  const cleaned = cleanRef(ref).toLowerCase();
  // Path relative to the doc, or to the repo root.
  if (existsSync(resolve(docDir, cleaned))) return true;
  if (existsSync(resolve(ROOT, cleaned))) return true;
  // Or the tail of any real repo file (module-relative references).
  return matchesTail(cleaned);
}

let checked = 0;
const failures = [];

for (const file of listDocs()) {
  const abs = join(ROOT, file);
  const docDir = dirname(abs);
  for (const ref of extractRefs(readFileSync(abs, 'utf8'))) {
    if (isIgnored(ref)) continue;
    checked += 1;
    if (!resolves(ref, docDir)) failures.push({ file: file.split(/[\\/]/).join('/'), ref });
  }
}

if (failures.length > 0) {
  console.error(`docs:check — ${failures.length} broken reference(s) found:\n`);
  for (const { file, ref } of failures) console.error(`  ${file}  ->  ${ref}`);
  console.error(
    '\nFix the path in the doc, or restore the file. See docs/README.md ("Keeping docs honest").',
  );
  process.exit(1);
}

console.log(
  `docs:check — ${checked} file references verified against ${REPO_FILE_SET.size} repo files.`,
);
