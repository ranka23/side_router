#!/usr/bin/env node

/**
 * SideRouter Build Script
 * Creates minified, production-ready ZIP files for Chrome and Firefox.
 *
 * Usage:
 *   node scripts/build.js          # Build both Chrome and Firefox
 *   node scripts/build.js --chrome # Chrome only
 *   node scripts/build.js --firefox # Firefox only
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TEMP_CHROME = path.join(DIST, '_chrome_tmp');
const TEMP_FIREFOX = path.join(DIST, '_firefox_tmp');

// Files and dirs to exclude from the extension ZIP
const EXCLUDE_DIRS = [
  'node_modules', 'tests', 'screenshots', '.git', 'dist',
  '.kilo', '.vscode', '.cocoindex_code',
];
const EXCLUDE_FILES = [
  'package.json', 'package-lock.json', 'README.md', 'AGENTS.md',
  'expansion-plan-v2.md', '.gitignore', 'privacy-policy.html',
  'store-assets', 'scripts', 'Dockerfile', 'docker-compose.yml',
];

// Parse CLI args
const args = process.argv.slice(2);
const buildChrome = args.includes('--chrome') || args.length === 0;
const buildFirefox = args.includes('--firefox') || args.length === 0;

function getArg() { return ''; }

function log(msg) { console.log(`  ${msg}`); }

function exec(cmd) { return execSync(cmd, { cwd: ROOT, stdio: 'pipe' }).toString().trim(); }

function sizeStr(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(p);
    else total += fs.statSync(p).size;
  }
  return total;
}

function copyRecursive(src, dest, excludeDirs, excludeFiles) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const relPath = path.relative(ROOT, srcPath);

    // Skip excluded dirs
    if (entry.isDirectory()) {
      if (excludeDirs.includes(entry.name) || excludeDirs.some(e => relPath.startsWith(e))) continue;
      copyRecursive(srcPath, path.join(dest, entry.name), excludeDirs, excludeFiles);
      continue;
    }

    // Skip excluded files
    if (excludeFiles.includes(entry.name) || excludeFiles.some(e => relPath === e || relPath.startsWith(e))) continue;

    fs.copyFileSync(srcPath, path.join(dest, entry.name));
  }
}

function minifyJS(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      minifyJS(p);
    } else if (entry.name.endsWith('.js')) {
      try {
        const code = fs.readFileSync(p, 'utf8');
        const result = execSync(
          `npx terser --compress passes=3 --mangle --comments false`,
          { input: code, cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString();
        fs.writeFileSync(p, result);
      } catch (e) {
        console.warn(`  ⚠ terser failed for ${entry.name}: ${e.message.split('\n')[0]}`);
      }
    }
  }
}

function minifyCSS(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      minifyCSS(p);
    } else if (entry.name.endsWith('.css')) {
      try {
        execSync(`npx csso "${p}" --output "${p}"`, { cwd: ROOT, stdio: 'pipe' });
      } catch (e) {
        console.warn(`  ⚠ csso failed for ${entry.name}: ${e.message.split('\n')[0]}`);
      }
    }
  }
}

function minifyHTML(filePath) {
  try {
    const tmpFile = filePath + '.tmp';
    execSync(
      `npx html-minifier-terser --collapse-whitespace --remove-comments --remove-redundant-attributes --remove-script-type-attributes --remove-style-link-type-attributes --use-short-doctype --minify-css true --minify-js true -o "${tmpFile}" "${filePath}"`,
      { cwd: ROOT, stdio: 'pipe' }
    );
    fs.renameSync(tmpFile, filePath);
  } catch (e) {
    console.warn(`  ⚠ html-minifier failed: ${e.message.split('\n')[0]}`);
  }
}

function build(target, tempDir, manifestSrc) {
  console.log(`\n🔨 Building ${target} extension...\n`);

  // Clean temp dir
  fs.rmSync(tempDir, { recursive: true, force: true });

  // Copy files
  log('📁 Copying source files...');
  // Copy src/ and media/ directories
  copyRecursive(path.join(ROOT, 'src'), path.join(tempDir, 'src'), EXCLUDE_DIRS, EXCLUDE_FILES);
  copyRecursive(path.join(ROOT, 'media'), path.join(tempDir, 'media'), EXCLUDE_DIRS, EXCLUDE_FILES);

  // Copy main.html
  fs.copyFileSync(path.join(ROOT, 'main.html'), path.join(tempDir, 'main.html'));

  // Copy manifest (Chrome uses manifest.json, Firefox needs manifest.firefox.json → manifest.json)
  fs.copyFileSync(path.join(ROOT, manifestSrc), path.join(tempDir, 'manifest.json'));

  const beforeSize = dirSize(tempDir);

  // Minify JS
  log('🗜️  Minifying JavaScript...');
  minifyJS(path.join(tempDir, 'src'));

  // Minify CSS
  log('🎨 Optimizing CSS...');
  minifyCSS(path.join(tempDir, 'src'));

  // Minify HTML
  log('📄 Minifying HTML...');
  minifyHTML(path.join(tempDir, 'main.html'));

  const afterSize = dirSize(tempDir);

  // Create ZIP
  const zipName = target.toLowerCase();
  const zipPath = path.join(DIST, `${zipName}.zip`);
  fs.mkdirSync(DIST, { recursive: true });

  // Remove old ZIP
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  log('📦 Creating ZIP archive...');
  exec(`cd "${tempDir}" && zip -r "${zipPath}" . -x "*.DS_Store" -x "._*"`);

  const zipSize = fs.statSync(zipPath).size;

  // Report
  console.log(`\n  ✅ ${target} build complete!`);
  console.log(`  📊 Before minification: ${sizeStr(beforeSize)}`);
  console.log(`  📊 After minification:  ${sizeStr(afterSize)}`);
  console.log(`  📊 ZIP archive:         ${sizeStr(zipSize)}`);
  console.log(`  📁 Output: ${zipPath}`);

  // Cleanup temp
  fs.rmSync(tempDir, { recursive: true, force: true });

  return { before: beforeSize, after: afterSize, zip: zipSize };
}

// ── Main ─────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════');
console.log('  SideRouter Build Script');
console.log('═══════════════════════════════════════════');

fs.mkdirSync(DIST, { recursive: true });
const results = {};

if (buildChrome) {
  results.chrome = build('Chrome', TEMP_CHROME, 'manifest.json');
}

if (buildFirefox) {
  results.firefox = build('Firefox', TEMP_FIREFOX, 'manifest.firefox.json');
}

// Summary
console.log('\n═══════════════════════════════════════════');
console.log('  Build Summary');
console.log('═══════════════════════════════════════════');
for (const [target, r] of Object.entries(results)) {
  console.log(`\n  ${target}:`);
  console.log(`    Source → Minified: ${sizeStr(r.before)} → ${sizeStr(r.after)} (${Math.round((1 - r.after / r.before) * 100)}% reduction)`);
  console.log(`    Final ZIP: ${sizeStr(r.zip)}`);
}
console.log('');