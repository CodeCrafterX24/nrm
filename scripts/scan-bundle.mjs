// Scan the original ncc bundle: embedded package versions + app-module require ids
import fs from "node:fs";

const s = fs.readFileSync("index.js", "utf8");

// 1) Embedded package.json modules: module.exports = JSON.parse('{"name":"x",...,"version":"y",...}')
const versions = {};
const pkgRe = /JSON\.parse\('\{"name":"([^"]+)"[\s\S]{0,600}?"version":"([^"]+)"/g;
let m;
while ((m = pkgRe.exec(s))) {
  if (!versions[m[1]]) versions[m[1]] = m[2];
}
console.log("EMBEDDED VERSIONS:", JSON.stringify(versions, null, 1));

// 2) App module boundaries
const lines = s.split("\n");
const starts = [];
lines.forEach((l, i) => {
  const mm = /^\/\*\*\*\/ (\d+):$/.exec(l.trim());
  if (mm) starts.push({ id: Number(mm[1]), line: i });
});
const APP_IDS = [44286, 60202, 47163, 80758, 60425, 74571, 62310, 12605, 5849, 4562,
  51640, 71514, 8939, 5831, 5764, 84790, 29352, 36444, 59163, 53565,
  75062, 44904, 91837, 87621, 72495, 80290, 8390, 73748, 45244, 11496];

// requires inside app modules only
const unknown = new Map();
for (const st of starts.filter(x => APP_IDS.includes(x.id))) {
  const end = starts.find(x => x.line > st.line);
  const body = lines.slice(st.line, end ? end.line : lines.length).join("\n");
  const reqRe = /__nccwpck_require__\.?(?:ab)?\(?(\d+)\)?/g;
  const ids = new Set();
  let r;
  const useRe = /__nccwpck_require__\((\d+)\)/g;
  while ((r = useRe.exec(body))) ids.add(Number(r[1]));
  const externals = [...ids].filter(x => !APP_IDS.includes(x));
  if (externals.length) console.log(`app ${st.id}: externals ->`, externals.join(","));
  for (const e of externals) if (!unknown.has(e)) unknown.set(e, st.id);
}
console.log("ALL EXTERNAL IDS USED BY APP:", [...unknown.keys()].sort((a, b) => a - b).join(","));
