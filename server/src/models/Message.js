"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Message = void 0;
const BaseModel_1 = require("./BaseModel.js");
const User_1 = require("./User.js");
class ReplyTo {
    id;
    username;
    text;
    constructor(json) {
        this.id = json.id;
        // guard: client-controlled payload may lack text
        this.text = typeof json.text === "string" ? json.text.substr(0, 50) : ""; // don't store more than 50 character
        this.username = json.username;
    }
}
class Message extends BaseModel_1.BaseModel {
    text;
    username;
    time;
    replyTo;
    edited_at;
    role = User_1.RoleEnum.NON_ADMIN;
    reactions;
    /** attached media (voice/photo) — { mediaId, mime, seconds? }; the payload
        itself lives in the media store, never inside the message */
    media;
    constructor(json = {}) {
        super(json);
        this.text = json.text || "";
        this.username = json.username || "";
        this.time = json.time || "";
        this.replyTo = json.replyTo ? new ReplyTo(json.replyTo) : null;
        this.reactions = json.reactions || {};
        // owner request 2026-11-08: voice/photo messages — only a tightly
        // shaped object crosses the boundary; the payload id must match m+
        // base36 (assigned by the media store) and the mime must be an
        // image/audio type the media store actually accepts
        const m = json.media;
        const MIME_OK = /^image\/(png|jpeg|webp|gif)$|^audio\/(webm|ogg|mp4|mpeg)$/;
        this.media = (m && typeof m === "object" && typeof m.mediaId === "string" && /^m[0-9a-z]+$/.test(m.mediaId)
            && typeof m.mime === "string" && m.mime.length <= 40 && MIME_OK.test(m.mime))
            ? { mediaId: m.mediaId, mime: m.mime, seconds: Number.isFinite(m.seconds) ? Math.round(m.seconds) : undefined }
            : null;
    }
}
exports.Message = Message;
