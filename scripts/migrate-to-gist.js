// One-time migration: push existing data/*.json (disk storage) into encrypted gists.
// Usage:
//   githubGist_token=... githubGist_username=... encryption_password=... node scripts/migrate-to-gist.js
// Run from the project root so ./data is picked up.
"use strict";
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { MemoryGistRepository } = require("../server/src/repositories/MemoryGistRepository.js");
const { ShardedGistMessageRepository } = require("../server/src/repositories/ShardedGistMessageRepository.js");

const creds = {
  token: process.env.githubGist_token,
  username: process.env.githubGist_username,
};
const pass = process.env.encryption_password || "";
if (!creds.token || !creds.username || !pass) {
  console.error("githubGist_token, githubGist_username and encryption_password are required");
  process.exit(1);
}
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

async function migrate(modelName, repo) {
  const file = path.join(DATA_DIR, `${modelName}.json`);
  if (!fs.existsSync(file)) {
    console.log(`skip ${modelName}: ${file} not found`);
    return;
  }
  const items = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`${modelName}: importing ${items.length} item(s)...`);
  for (const item of items) {
    delete item.id; // repos assign fresh monotonic ids
    await repo.add(item);
  }
  await repo.flush();
  console.log(`${modelName}: done`);
}

(async () => {
  await migrate("User", new MemoryGistRepository(creds, "User", pass));
  await migrate("Setting", new MemoryGistRepository(creds, "Setting", pass));
  await migrate("Message", new ShardedGistMessageRepository(creds, "Message", pass));
  console.log("migration complete.");
  process.exit(0);
})().catch((err) => {
  console.error("migration failed:", err.message);
  process.exit(1);
});
