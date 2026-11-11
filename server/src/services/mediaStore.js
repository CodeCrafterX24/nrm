"use strict";
/**
 * Chat media storage (owner request 2026-11-08): voice messages + photos.
 *
 * One media item = one store item on the SAME backend family as the notepad:
 *   - disk backend (local dev): data/Media.json
 *   - gist backend (Render):    sharded gists — a base64 payload ≤ ~300KB raw
 *     stays far below the ~1MB per-file gist limit even after encryption
 *     (~1.35x), so a single-chunk item is the whole design.
 *
 * Sizes: photos are compressed client-side (max ~2000px, JPEG ~0.75) and voice
 * is capped at ~3 minutes (MediaRecorder, opus ~24kbps → well under the cap).
 * The server enforces a hard byte cap anyway (MEDIA_MAX_BASE64_CHARS).
 *
 * Memory-authoritative like every repo here: reads come from RAM after the
 * first load; writes flush write-behind. `removeAll` (chat history delete)
 * also wipes the media store so a deleted conversation leaves no orphans.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEDIA_MAX_BASE64_CHARS = exports.MAX_MEDIA_SECONDS = void 0;
exports.putMedia = putMedia;
exports.getMedia = getMedia;
exports.removeMedia = removeMedia;
exports.removeAllMedia = removeAllMedia;
exports.mediaInfo = mediaInfo;
const logger_1 = require("../logger.js");
const Storage_1 = require("../models/storageTypes.js");
const ShardedNoteRepository_1 = require("../repositories/ShardedNoteRepository.js");
const DiskStorageRepositoryImpl_1 = require("../repositories/DiskStorageRepositoryImpl.js");
const log = (0, logger_1.default)(__filename);
// voice recording cap for the client (server only advertises it; the byte cap
// below is the real enforcement)
const MAX_MEDIA_SECONDS = 180;
exports.MAX_MEDIA_SECONDS = MAX_MEDIA_SECONDS;
// base64 chars cap: 300_000 b64 chars ≈ 225KB binary ≈ 300KB raw JSON item —
// ~400KB encrypted, a 2.5x margin under the ~1MB gist file limit
const MEDIA_MAX_BASE64_CHARS = 300000;
exports.MEDIA_MAX_BASE64_CHARS = MEDIA_MAX_BASE64_CHARS;
let mediaRepository = null;
let mediaSeq = 0;
/** Media storage follows the deployment's primary backend (noteStore pattern) */
function getMediaRepository() {
    if (!mediaRepository) {
        const defaultStorage = process.env.REPOSITORY_NAME || Storage_1.StorageTypes.diskStorage;
        const storageType = defaultStorage === Storage_1.StorageTypes.githubGistStorage
            ? Storage_1.StorageTypes.githubGistStorage
            : Storage_1.StorageTypes.diskStorage;
        if (storageType === Storage_1.StorageTypes.githubGistStorage) {
            const token = process.env.githubGist_token ?? "";
            const username = process.env.githubGist_username ?? "";
            if (!token || !username) {
                log.error("githubGist env vars are required for githubGistStorage (Media)");
                throw new Error("gist credentials missing for Media storage");
            }
            mediaRepository = new ShardedNoteRepository_1.ShardedNoteRepository(
                { token, username }, Storage_1.StorageModels.Media, process.env.encryption_password ?? "");
        }
        else {
            mediaRepository = new DiskStorageRepositoryImpl_1.DiskStorageRepositoryImpl(Storage_1.StorageModels.Media);
        }
    }
    return mediaRepository;
}
/** in-RAM index so GET /:id never needs a store scan after the first load */
const index = new Map();
async function indexAll() {
    const repo = getMediaRepository();
    const items = await repo.get();
    index.clear();
    for (const it of items) {
        if (it && typeof it.mediaId === "string") {
            index.set(it.mediaId, { item: it, at: Date.now() });
        }
    }
}
let ensured = false;
async function ensureIndex() {
    if (ensured)
        return;
    await indexAll();
    ensured = true;
}
/** store one media payload; returns its public id ("m" + counter + rand) */
async function putMedia({ mime, data }) {
    if (typeof mime !== "string" || !/^image\/(png|jpeg|webp|gif)$|^audio\/(webm|ogg|mp4|mpeg)$/.test(mime))
        throw new Error("unsupported media type");
    if (typeof data !== "string" || !data.length)
        throw new Error("empty media payload");
    if (data.length > MEDIA_MAX_BASE64_CHARS)
        throw new Error("media too large");
    await ensureIndex();
    const repo = getMediaRepository();
    const mediaId = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const item = { mediaId, mime, data, bytes: Math.floor(data.length * 0.75), createdAt: new Date().toISOString() };
    await repo.add(item);
    index.set(mediaId, { item, at: Date.now() });
    // keep the RAM index bounded: drop the base64 of items older than the
    // newest 200 — re-reads hydrate from the store on demand (putMedia keeps
    // its own copy in `item` so the flush path is unaffected)
    if (index.size > 200) {
        let oldestKey = null, oldestAt = Infinity;
        for (const [k, v] of index) {
            if (v.at < oldestAt) { oldestAt = v.at; oldestKey = k; }
        }
        if (oldestKey && oldestKey !== mediaId) index.delete(oldestKey);
    }
    log.info(`media stored: ${mediaId} ${mime} ${item.bytes}B`);
    return { mediaId, bytes: item.bytes };
}
/** fetch one payload (hydrates from the store when evicted from the RAM index) */
async function getMedia(mediaId) {
    if (typeof mediaId !== "string" || !/^m[0-9a-z]+$/.test(mediaId))
        return null;
    await ensureIndex();
    let hit = index.get(mediaId);
    if (!hit || !hit.item || typeof hit.item.data !== "string") {
        const repo = getMediaRepository();
        const found = (await repo.get()).find((it) => it && it.mediaId === mediaId);
        if (!found) return null;
        hit = { item: found, at: Date.now() };
        index.set(mediaId, hit);
    }
    hit.at = Date.now();
    return { mime: hit.item.mime, data: hit.item.data, bytes: hit.item.bytes };
}
/** drop one media item (used when its message is deleted) */
async function removeMedia(mediaId) {
    if (typeof mediaId !== "string") return false;
    await ensureIndex();
    const hit = index.get(mediaId);
    if (hit) {
        const repo = getMediaRepository();
        await repo.remove(hit.item.id);
        index.delete(mediaId);
        return true;
    }
    // evicted from RAM (the index keeps only the newest 200) — find it in the
    // durable store so a delete never leaves an orphan payload behind
    const repo = getMediaRepository();
    const found = (await repo.get()).find((it) => it && it.mediaId === mediaId);
    if (!found) return false;
    await repo.remove(found.id);
    return true;
}
/** chat history deleted → wipe every media item too (no orphan payloads) */
async function removeAllMedia() {
    const repo = getMediaRepository();
    await repo.removeAll();
    index.clear();
}
/** media-cleanup sweep support (services/mediaCleanup.js): inspect ids+dates
 *  and delete a specific durable item — ALWAYS through this singleton repo so
 *  the sweep and the server's own write-behind share one state (two instances
 *  would race their flushes and resurrect deleted items on disk-mode) */
async function sweepListItems() {
    await ensureIndex();
    const repo = getMediaRepository();
    const items = await repo.get();
    return items
        .filter((it) => it && typeof it.mediaId === "string")
        .map((it) => ({ id: it.id, mediaId: it.mediaId, createdAt: it.createdAt || "" }));
}
async function sweepRemoveById(durableId) {
    const repo = getMediaRepository();
    await repo.remove(durableId);
}
exports.sweepListItems = sweepListItems;
exports.sweepRemoveById = sweepRemoveById;
/** full sweep step used by services/mediaCleanup.js: delete durable items whose
 *  mediaId is NOT in `referenced` and whose createdAt predates `cutoffMs` —
 *  always through the singleton repo (one writer, no flush races) */
async function sweepUnreferenced(referenced, cutoffMs) {
    await ensureIndex();
    const repo = getMediaRepository();
    const items = await repo.get();
    let count = 0, keptRef = 0, keptFresh = 0;
    for (const it of items) {
        if (!it || typeof it.mediaId !== "string") continue;
        if (referenced.has(it.mediaId)) { keptRef++; continue; }
        const created = Date.parse(it.createdAt || "") || 0;
        if (created > cutoffMs) { keptFresh++; continue; }
        try { await repo.remove(it.id); count++; index.delete(it.mediaId); } // sweep: also drop the RAM copy
        catch (err) { log.error(`media sweep: removing ${it.mediaId} failed: ${err.message}`); }
    }
    return { count, keptRef, keptFresh };
}
exports.sweepUnreferenced = sweepUnreferenced;

/** metadata only (no payload) — for size/type headers */
async function mediaInfo(mediaId) {
    if (typeof mediaId !== "string" || !/^m[0-9a-z]+$/.test(mediaId))
        return null;
    await ensureIndex();
    const hit = index.get(mediaId);
    if (hit) return { mime: hit.item.mime, bytes: hit.item.bytes };
    const found = (await getMediaRepository().get()).find((it) => it && it.mediaId === mediaId);
    return found ? { mime: found.mime, bytes: found.bytes } : null;
}
