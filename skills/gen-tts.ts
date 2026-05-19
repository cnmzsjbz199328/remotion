// Phase 2 implementation: synthesise TTS audio for all script segments.
// See .claude/skills/gen-tts/SKILL.md for the full spec.
export {};

const _args = process.argv.slice(2);
const _getArg = (flag: string) => { const i = _args.indexOf(flag); return i !== -1 ? _args[i + 1] : undefined; };
const date = _getArg("--date") ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);

console.log(`[gen-tts] date: ${date}`);
console.log("⚠️  Not yet implemented — coming in Phase 2.");
console.log(`   Will write: cache/tts/${date}/*.mp3 + cache/tts-manifest-${date}.json`);
process.exit(0);
