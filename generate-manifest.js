#!/usr/bin/env node
/**
 * Rebuilds library/manifest.json by scanning the library/ folder for
 * per-competition subfolders full of exported *.json question sets.
 *
 * No network access needed — this only reads files already on disk.
 *
 * Expected layout (created by exporting sets from the Sci Bowl Reader app):
 *
 *   library/
 *     johns-hopkins-invitational-2025/
 *       round-1.json
 *       round-2.json
 *     stanford-science-bowl-2025/
 *       round-1.json
 *       ...
 *
 * Each *.json file is whatever "Export as JSON…" in the app produced:
 *   { "meta": { "competition": "...", "round": "...", ... }, "questions": [...] }
 *
 * Usage:
 *   node generate-manifest.js            # scans ./library, writes ./library/manifest.json
 *   node generate-manifest.js path/to/library
 */
const fs = require('fs');
const path = require('path');

const libraryDir = path.resolve(process.argv[2] || 'library');

if (!fs.existsSync(libraryDir)) {
  console.error(`No such directory: ${libraryDir}`);
  process.exit(1);
}

function titleCaseFromSlug(slug) {
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const competitions = [];

const entries = fs.readdirSync(libraryDir, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name));

for (const dirEntry of entries) {
  const compDir = path.join(libraryDir, dirEntry.name);
  const files = fs.readdirSync(compDir)
    .filter(f => f.toLowerCase().endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) continue;

  let competitionName = titleCaseFromSlug(dirEntry.name);
  const sets = [];

  for (const file of files) {
    const fullPath = path.join(compDir, file);
    let label = titleCaseFromSlug(path.basename(file, '.json'));
    try {
      const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      if (raw.meta) {
        if (raw.meta.competition) competitionName = raw.meta.competition;
        if (raw.meta.round) label = raw.meta.round;
      }
    } catch (e) {
      console.warn(`  ! could not parse ${fullPath}, using filename for label: ${e.message}`);
    }
    sets.push({
      label,
      file: `${dirEntry.name}/${file}`
    });
  }

  competitions.push({ name: competitionName, sets });
  console.log(`${competitionName}: ${sets.length} set(s)`);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  competitions
};

const outPath = path.join(libraryDir, 'manifest.json');
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`\nWrote ${outPath} (${competitions.length} competition(s))`);
