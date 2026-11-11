"use strict";
/**
 * Media auto-cleanup (owner request 2026-11-08): free-tier RAM/gist budget is
 * finite, so media payloads older than MEDIA_RETENTION_DAYS (default 30) that
 * are NOT referenced by any message still in the history are removed by a
 * daily sweep.
 *
 * Safety rules:
 *   - a media referenced by ANY message in the message store is kept, no
 *     matter how old (the message would render broken otherwise)
 *   - only mediaStore items are touched — messages, users, settings never
 *   - the sweep runs once a day (MEDIA_CLEANUP_INTERVAL_H, default 24) and
 *     once shortly after boot (2 min), logging what it removed
 *   - mode "all" would wipe every unreferenced media regardless of age; the
 *     default "aged" mode respects the retention window
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEDIA_RETENTION_DAYS = exports.MEDIA_CLEANUP_INTERVAL_H = void 0;
exports.collectReferencedMediaIds = collectReferencedMediaIds;
exports.runMediaCleanup = runMediaCleanup;
exports.startMediaCleanupLoop = startMediaCleanupLoop;
const logger_1 = require("../logger.js");
const config_1 = require("../config/repositoryFactory.js");
const mediaStore_1 = require("./mediaStore.js");
const log = (0, logger_1.default)(__filename);
const MEDIA_RETENTION_DAYS = Math.max(parseInt(process.env.MEDIA_RETENTION_DAYS || "30", 10), 1);
exports.MEDIA_RETENTION_DAYS = MEDIA_RETENTION_DAYS;
const MEDIA_CLEANUP_INTERVAL_H = Math.max(parseInt(process.env.MEDIA_CLEANUP_INTERVAL_H || "24", 10), 1);
exports.MEDIA_CLEANUP_INTERVAL_H = MEDIA_CLEANUP_INTERVAL_H;
/** every mediaId referenced by a message still present in the history */
async function collectReferencedMediaIds() {
    const ids = new Set();
    try {
        const items = await (0, config_1.getMessageRepository)().get();
        for (const m of items) {
            const id = m && m.media && m.media.mediaId;
            if (typeof id === "string")
                ids.add(id);
        }
    }
    catch (err) {
        log.error("media cleanup: reading message history failed:", err.message);
    }
    return ids;
}
/** one sweep: removes unreferenced media older than the retention window.
 *  @returns removed count (or -1 when skipped) */
async function runMediaCleanup() {
    const referenced = await collectReferencedMediaIds();
    // the message history itself decides: an empty history (e.g. after
    // delete-all or on a fresh boot in memory mode) frees every orphan;
    // a full history protects exactly what it references
    const cutoff = Date.now() - MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    // walk the media store through ITS SINGLETON (mediaStore.js) — a separate
    // repo instance would race the server's write-behind flush and resurrect
    // deleted items (disk-mode) / fight shard state (gist-mode)
    const removed = await mediaStore_1.sweepUnreferenced(referenced, cutoff);
    log.info(`media cleanup: removed ${removed.count}, kept referenced ${removed.keptRef}, kept fresh ${removed.keptFresh} (retention ${MEDIA_RETENTION_DAYS}d)`);
    return removed.count;
    log.info(`media cleanup: removed ${removed}, kept referenced ${keptRef}, kept fresh ${keptFresh} (retention ${MEDIA_RETENTION_DAYS}d)`);
    return removed;
}
let started = false;
/** boot + daily loop; safe to call multiple times */
function startMediaCleanupLoop() {
    if (started)
        return;
    started = true;
    // shortly after boot (let the repositories finish their first load)
    setTimeout(() => {
        runMediaCleanup().catch((err) => log.error("media cleanup (boot) failed:", err.message));
    }, 2 * 60 * 1000);
    setInterval(() => {
        runMediaCleanup().catch((err) => log.error("media cleanup failed:", err.message));
    }, MEDIA_CLEANUP_INTERVAL_H * 60 * 60 * 1000);
    log.info(`media auto-cleanup active: retention ${MEDIA_RETENTION_DAYS}d, every ${MEDIA_CLEANUP_INTERVAL_H}h`);
}
