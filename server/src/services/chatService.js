"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deleteAllChat = exports.buildExportTxt = exports.buildExportJson = exports.downloadAll = exports.downloadJson = void 0;
const logger_1 = __importDefault(require("../logger.js"));
const ClientError_1 = require("../models/ClientError.js");
const config_1 = require("../config/repositoryFactory.js");
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const log = (0, logger_1.default)(__filename);
async function getAllMessages() {
    const repository = (0, config_1.getMessageRepository)();
    return repository.get();
}
function plainText(html) {
    // strip markup and collapse whitespace — safe for plain notes
    return (0, sanitize_html_1.default)(String(html ?? ""), { allowedTags: [], allowedAttributes: {} })
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function formatTimestamp(iso) {
    // stable universal "YYYY-MM-DD HH:mm" in the room's timezone
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return String(iso || "");
    const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: process.env.HIJRI_TIMEZONE || "Asia/Dhaka",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
// Download JSON file with filtered messages (admin endpoint)
const downloadJson = async (res) => {
    log.debug("download all called");
    const messages = await getAllMessages();
    const filteredMessages = messages.map(({ username, text, time, replyTo }) => ({
        username,
        text,
        time,
        replyTo,
    }));
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=Message.json");
    res.status(200).send(JSON.stringify(filteredMessages, null, 2));
};
exports.downloadJson = downloadJson;
// Download JSON file with filtered messages (admin endpoint)
const downloadAll = async () => {
    log.debug("download all called");
    const messages = await getAllMessages();
    return messages.map(({ username, text, time, replyTo }) => ({
        username,
        text,
        time,
        replyTo,
    }));
};
exports.downloadAll = downloadAll;
/** raw full history for the json export option */
const buildExportJson = async () => {
    const messages = await getAllMessages();
    return messages.map((m) => ({
        id: m.id,
        username: m.username,
        time: m.time,
        text: m.text,
        replyTo: m.replyTo || null,
        edited_at: m.edited_at || null,
        reactions: m.reactions && Object.keys(m.reactions).length ? m.reactions : undefined,
    }));
};
exports.buildExportJson = buildExportJson;
/** localized labels for the plain-text export (the room is bn/en bilingual) */
const TXT_I18N = {
    bn: {
        title: "Our Discussion Room — পূর্ণ কথোপকথন",
        exported: "এক্সপোর্ট",
        total: "মোট মেসেজ",
        edited: "(সম্পাদিত)",
        media: "(মিডিয়া/HTML মেসেজ)",
        replyTo: "উত্তর →",
    },
    en: {
        title: "Our Discussion Room — full conversation",
        exported: "Exported",
        total: "Total messages",
        edited: "(edited)",
        media: "(media/HTML message)",
        replyTo: "reply to",
    },
};
/** clean plain-text rendering of the whole conversation — paste-ready for notes */
const buildExportTxt = async (lang = "bn") => {
    const i18n = TXT_I18N[lang] || TXT_I18N.bn;
    const messages = await getAllMessages();
    const line = "--------------------------------------";
    const header = [
        "======================================",
        i18n.title,
        `${i18n.exported}: ${formatTimestamp(new Date().toISOString())}`,
        `${i18n.total}: ${messages.length}`,
        "======================================",
        "",
    ].join("\n");
    const body = messages.map((m) => {
        const stamp = formatTimestamp(m.time);
        const edited = m.edited_at ? `  ${i18n.edited}` : "";
        const text = plainText(m.text) || i18n.media;
        const lines = [`[${stamp}] ${m.username || "?"}:`, text + edited];
        if (m.replyTo) {
            const quoted = plainText(m.replyTo.text).slice(0, 80);
            lines.splice(1, 0, `    ↳ ${i18n.replyTo} ${m.replyTo.username || "?"}${m.replyTo.id ? ` (#${m.replyTo.id})` : ""}: "${quoted}"`);
        }
        return lines.join("\n");
    }).join(`\n\n${line}\n\n`);
    return header + body + "\n";
};
exports.buildExportTxt = buildExportTxt;
const deleteAllChat = async (res) => {
    // Get the repository
    const repository = (0, config_1.getMessageRepository)();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    await repository.removeAll();
};
exports.deleteAllChat = deleteAllChat;
