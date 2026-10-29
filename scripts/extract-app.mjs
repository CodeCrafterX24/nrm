// Extract app modules from the original ncc bundle into a clean CommonJS source tree.
// Faithful copy: only __nccwpck_require__(ID) calls are rewritten to require("<target>").
import fs from "node:fs";
import path from "node:path";

const BUNDLE = "index.js";
const OUT_ROOT = "server/src";

// app module id -> output file (relative to OUT_ROOT)
const APP = {
  44286: "app.js",
  60202: "www.js",
  47163: "config/repositoryFactory.js",
  80758: "bootstrap/initData.js",
  60425: "logger.js",
  74571: "controllers/authController.js",
  62310: "controllers/chatController.js",
  12605: "controllers/settingController.js",
  5849: "controllers/userController.js",
  4562: "dto/BaseDto.js",
  51640: "dto/UserDto.js",
  71514: "socket/chatHandler.js",
  8939: "socket/userHandler.js",
  5831: "models/BaseModel.js",
  5764: "models/ClientError.js",
  84790: "models/Message.js",
  29352: "models/Setting.js",
  36444: "models/storageTypes.js",
  59163: "models/User.js",
  53565: "repositories/DiskStorageRepositoryImpl.js",
  75062: "repositories/QueuedGitHubGistRepository.js",
  44904: "repositories/PtStorageRepositoryImpl.js",
  91837: "routes/authRouter.js",
  87621: "routes/apiRouter.js",
  72495: "services/authService.js",
  80290: "services/chatService.js",
  8390: "services/settingService.js",
  73748: "socket/socketService.js",
  45244: "services/userCrudService.js",
  11496: "socket/socketEvents.js",
};

// external webpack id -> npm package / node builtin
const EXT = {
  12437: "dotenv",
  71204: "express",
  41354: "express-session",
  1732: "memorystore",
  4158: "winston",
  44079: "bcryptjs", // original used native bcrypt; bcryptjs is a drop-in (no native build on Render)
  51473: "socket.io",
  38237: "debug",
  34134: "crypto-js",
  7761: "protectedtext-api",
  71017: "path",
  57147: "fs",
  13685: "http",
  12781: "stream",
};

const s = fs.readFileSync(BUNDLE, "utf8").replace(/\r\n/g, "\n");
const lines = s.split("\n");

// locate module starts
const starts = [];
lines.forEach((l, i) => {
  const m = /^\/\*\*\*\/ (\d+):$/.exec(l);
  if (m) starts.push({ id: Number(m[1]), line: i });
});

const startById = new Map(starts.map(x => [x.id, x]));

function extractBody(id) {
  const st = startById.get(id);
  if (!st) throw new Error(`module ${id} not found`);
  const wrapper = lines[st.line + 1];
  if (!/^\s*\/\*\*\*\/\s*\(/.test(wrapper)) throw new Error(`module ${id}: unexpected wrapper line: ${wrapper}`);
  // body: lines after wrapper, until a line that starts with "/***/ })"
  let i = st.line + 2;
  if (lines[i] === "") i++;
  const bodyLines = [];
  while (i < lines.length && !lines[i].startsWith("/***/ })")) {
    bodyLines.push(lines[i]);
    i++;
  }
  // trim trailing blank lines
  while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === "") bodyLines.pop();
  return bodyLines.join("\n");
}

function relRequire(fromRel, toRel) {
  const fromDir = path.dirname(path.join(OUT_ROOT, fromRel));
  let rel = path.relative(fromDir, path.join(OUT_ROOT, toRel)).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

const warnings = [];
for (const [idStr, outRel] of Object.entries(APP)) {
  const id = Number(idStr);
  let body = extractBody(id);
  // rewrite requires
  body = body.replace(/__nccwpck_require__\((\d+)\)/g, (_, rid) => {
    rid = Number(rid);
    if (APP[rid]) return `require(${JSON.stringify(relRequire(outRel, APP[rid]))})`;
    if (EXT[rid]) return `require(${JSON.stringify(EXT[rid])})`;
    warnings.push(`module ${id}: UNKNOWN require id ${rid}`);
    return `require("UNKNOWN_${rid}")`;
  });
  const outPath = path.join(OUT_ROOT, outRel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body.replace(/\n/g, "\n") + "\n", "utf8");
  console.log(`wrote ${outPath} (${body.split("\n").length} lines)`);
}

if (warnings.length) {
  console.error("WARNINGS:\n" + warnings.join("\n"));
  process.exitCode = 1;
} else {
  console.log("extraction OK, no unknown ids");
}
