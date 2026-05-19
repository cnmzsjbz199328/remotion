// Phase 3 implementation: collect images from article og:image, scraping, and Pexels.
// See .claude/skills/collect-assets/SKILL.md for the full spec.
export {};

const _args = process.argv.slice(2);
const _getArg = (flag: string) => { const i = _args.indexOf(flag); return i !== -1 ? _args[i + 1] : undefined; };
const date = _getArg("--date") ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);

console.log(`[collect-assets] date: ${date}`);
console.log("⚠️  Not yet implemented — coming in Phase 3.");
console.log(`   Will write: cache/assets/${date}/*.jpg + cache/assets-${date}.json`);
process.exit(0);
