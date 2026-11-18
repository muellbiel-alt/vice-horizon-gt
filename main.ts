// Entrypoint for Solara Bay: Heatline (gta6-01, Node 22 standard library only).
// Copies game/ and screenshots/ to MAKEFUN_OUTPUT_DIR (or /output), runs local gate checks
// (file counts, size caps, offline references, screenshot bounds, dossier size), and writes
// deterministic canonical dossier.json via vendor/makefun-game.ts.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, htmlFacts, importOrder, isRelativeRef, readGameTree, sourceImports } from './vendor/makefun-game.ts';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};
const DOSSIER_GATE_MAX_BYTES = 1572864;

function isOfflineSafeRef(ref: string): boolean {
  if (ref.startsWith('data:')) return true;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref) || ref.startsWith('//')) return false;
  return isRelativeRef(ref) || ref.startsWith('/');
}

function validateOutputGate(outDir: string, dossierBytes: Uint8Array): void {
  if (dossierBytes.length > DOSSIER_GATE_MAX_BYTES) {
    throw new Error(`Gate failed: dossier.json is ${dossierBytes.length} bytes (max ${DOSSIER_GATE_MAX_BYTES})`);
  }

  const gameDir = join(outDir, 'game');
  const tree = readGameTree(gameDir, CAPS);
  const indexHtml = readFileSync(join(gameDir, 'index.html'), 'utf8');
  const facts = htmlFacts(indexHtml);

  for (const s of facts.scripts) {
    if (s.src !== null && !isOfflineSafeRef(s.src)) {
      throw new Error(`Gate failed: external script reference "${s.src}" in index.html`);
    }
  }
  for (const l of facts.links) {
    if (!isOfflineSafeRef(l.href)) {
      throw new Error(`Gate failed: external link reference "${l.href}" in index.html`);
    }
  }
  for (const r of facts.resources) {
    if (!isOfflineSafeRef(r.src)) {
      throw new Error(`Gate failed: external media reference "${r.src}" in index.html`);
    }
  }

  const sources = tree.files
    .filter((f) => f.cls === 'source')
    .map((f) => ({ path: f.path, bytes: new Uint8Array(readFileSync(join(gameDir, f.path))) }));
  const reachable = importOrder(sources, facts);
  for (const modPath of reachable) {
    const code = readFileSync(join(gameDir, modPath), 'utf8');
    for (const spec of sourceImports(code)) {
      if (!isOfflineSafeRef(spec)) {
        throw new Error(`Gate failed: external module import "${spec}" in game/${modPath}`);
      }
    }
  }

  const shotFiles = readdirSync(join(outDir, 'screenshots')).filter((n) => !n.startsWith('.'));
  if (shotFiles.length < 3 || shotFiles.length > 4) {
    throw new Error(`Gate failed: screenshots/ requires 3 to 4 images, found ${shotFiles.length}`);
  }
  for (const name of shotFiles) {
    const sz = statSync(join(outDir, 'screenshots', name)).size;
    if (sz > CAPS.screenshots.max_bytes) {
      throw new Error(`Gate failed: screenshots/${name} is ${sz} bytes (max ${CAPS.screenshots.max_bytes})`);
    }
  }
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

const dossierBytes = buildDossier(out, CAPS);
validateOutputGate(out, dossierBytes);
writeFileSync(join(out, 'dossier.json'), dossierBytes);

