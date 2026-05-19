#!/usr/bin/env node
// Invoked by the render SKILL.md shell injection to show cache state.
// Usage: node scripts/check-cache.js [YYYY-MM-DD]

const fs = require("fs");
const path = require("path");

const date =
  process.argv[2] ||
  new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const files = [
  { label: "news", path: `cache/news-${date}.json`, skill: "fetch-news" },
  { label: "script", path: `cache/script-${date}.json`, skill: "gen-script" },
  { label: "tts-manifest", path: `cache/tts-manifest-${date}.json`, skill: "gen-tts" },
  { label: "assets", path: `cache/assets-${date}.json`, skill: "collect-assets" },
];

console.log(`Date: ${date}\n`);
for (const f of files) {
  const exists = fs.existsSync(path.resolve(f.path));
  const status = exists ? "✅" : "❌ missing — run /"+f.skill;
  console.log(`  ${status.padEnd(50)} ${f.path}`);
}
