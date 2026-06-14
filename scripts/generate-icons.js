#!/usr/bin/env node

/**
 * Generate extension icons from SVG design.
 * Outputs icon16.png, icon32.png, icon48.png, icon128.png to media/
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const MEDIA_DIR = path.resolve(__dirname, '..', 'media');

// SVG icon design — a modern chat bubble with AI sparkle
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#4f46e5"/>
    </linearGradient>
    <linearGradient id="bubble" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.95"/>
      <stop offset="100%" style="stop-color:#e0e7ff;stop-opacity:0.9"/>
    </linearGradient>
  </defs>
  <!-- Rounded background -->
  <rect x="4" y="4" width="120" height="120" rx="28" ry="28" fill="url(#bg)"/>
  <!-- Chat bubble (incoming/left) -->
  <rect x="18" y="28" width="56" height="38" rx="10" ry="10" fill="url(#bubble)"/>
  <polygon points="24,66 34,66 22,78" fill="#ffffff" opacity="0.95"/>
  <!-- Chat bubble (outgoing/right) -->
  <rect x="54" y="62" width="56" height="38" rx="10" ry="10" fill="#818cf8" opacity="0.9"/>
  <polygon points="104,100 94,100 106,112" fill="#818cf8" opacity="0.9"/>
  <!-- AI sparkle dot -->
  <circle cx="100" cy="28" r="7" fill="#34d399" opacity="0.9"/>
  <!-- Lines in left bubble (text) -->
  <rect x="28" y="38" width="32" height="4" rx="2" fill="#6366f1" opacity="0.25"/>
  <rect x="28" y="48" width="24" height="4" rx="2" fill="#6366f1" opacity="0.2"/>
  <rect x="28" y="56" width="28" height="4" rx="2" fill="#6366f1" opacity="0.15"/>
  <!-- Lines in right bubble (text) -->
  <rect x="64" y="72" width="32" height="4" rx="2" fill="#ffffff" opacity="0.6"/>
  <rect x="64" y="82" width="24" height="4" rx="2" fill="#ffffff" opacity="0.5"/>
  <rect x="64" y="92" width="28" height="4" rx="2" fill="#ffffff" opacity="0.4"/>
</svg>
`.trim();

const sizes = [16, 22, 32, 48, 128];

async function generate() {
  console.log('🎨 Generating extension icons...\n');

  for (const size of sizes) {
    const outputPath = path.join(MEDIA_DIR, `icon${size}.png`);
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(outputPath);

    const stat = fs.statSync(outputPath);
    console.log(`  ✅ icon${size}.png (${stat.size} bytes)`);
  }

  console.log('\n  Done! Icons updated in media/');
}

generate().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});