#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeBookmarklet } from '../src/core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const template = fs.readFileSync(path.join(root, 'ad-auto.template.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, 'src/core.mjs'), 'utf8');

const coreInlined = coreSrc
  .replace(/^\s*export\s+function\s+/gm, 'function ')
  .replace(/^\s*export\s+/gm, '');

const MARKER = /^[ \t]*\/\/ @inline:core[ \t]*$/m;
if (!MARKER.test(template)) {
  console.error('build: marker `// @inline:core` not found in ad-auto.template.js');
  process.exit(1);
}
const snippetBody = template.replace(MARKER, coreInlined.trimEnd());

const bookmarklet = encodeBookmarklet(snippetBody);

const preamble = `// Antimatter Dimensions — console auto-buy helpers + GUI panel
// GENERATED FILE. Do not edit. Source: ad-auto.template.js + src/core.mjs. Rebuild with: npm run build.
//
// Two installs:
//   1. Paste the SNIPPET below into DevTools console.
//   2. Or use the BOOKMARKLET at the bottom of this file.


// ---------- SNIPPET (paste into console) ----------

`;

const bookmarkletSection = `


// ---------- BOOKMARKLET (paste as URL of a new bookmark) ----------
//
// START:
// ${bookmarklet}
//
// STOP:
// javascript:(()=>{if(window.__auto)window.__auto.stop();else console.log('nothing running');})();void(0);
//
// RESET:
// javascript:(()=>{try{localStorage.removeItem('__auto_settings_v1');console.log('cleared')}catch(e){console.warn(e)}})();void(0);
`;

const out = preamble + snippetBody + bookmarkletSection;
fs.writeFileSync(path.join(root, 'ad-auto.js'), out);
console.log(`built ad-auto.js (${out.length} bytes; bookmarklet ${bookmarklet.length} chars)`);
