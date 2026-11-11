"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.handleChatMessage = handleChatMessage;
exports.handleEditMessage = handleEditMessage;
exports.handleReactMessage = handleReactMessage;
exports.handleDeleteMessage = handleDeleteMessage;
exports.handleDeleteChat = handleDeleteChat;
exports.handleUpdateNotice = handleUpdateNotice;
exports.handleUpdateFsNotice = handleUpdateFsNotice;
const config_1 = require("../config/repositoryFactory.js");
const logger_1 = __importDefault(require("../logger.js"));
const ClientError_1 = require("../models/ClientError.js");
const SocketEvents_1 = require("./socketEvents.js");
const User_1 = require("../models/User.js");
const Message_1 = require("../models/Message.js");
const htmlSanitizer_1 = require("../services/htmlSanitizer.js");
const permissions_1 = require("../services/permissions.js");
const log = (0, logger_1.default)(__filename);
/** every handler must acknowledge errors, otherwise the sender waits forever */
function safeCallback(callback, payload) {
    if (typeof callback === "function")
        callback(payload);
}
// Define the handler function for the "chatMessage" event
async function handleChatMessage(message, callback, socket) {
    log.debug(`Received chat message: ${JSON.stringify(message)}`);
    try {
        // owner request 2026-11-08: media messages (voice/photo) may carry an
        // empty text — a media object alone is a valid message body. Normalize
        // through the model FIRST so a malformed media payload cannot masquerade
        // as a media message (the model nulls a bad mediaId/mime).
        const normalized = new Message_1.Message(message);
        const hasMedia = !!(normalized.media && normalized.media.mediaId);
        message.media = normalized.media;
        if ((!message?.text?.trim()) && !hasMedia) {
            safeCallback(callback, ClientError_1.ClientError.invalidError());
            return;
        }
        if (message.text && message.text.length > htmlSanitizer_1.MAX_MESSAGE_CHARS) {
            safeCallback(callback, ClientError_1.ClientError.tooLargeError());
            return;
        }
        // get the repository
        const repository = (0, config_1.getMessageRepository)();
        message.username = socket.request.session.userInfo.username;
        message.role = socket.request.session.userInfo.isAdmin
            ? User_1.RoleEnum.ADMIN
            : User_1.RoleEnum.NON_ADMIN;
        // HTML in messages is supported — sanitize against a permissive allowlist server-side
        normalized.text = message.text ? (0, htmlSanitizer_1.sanitizeMessageHtml)(message.text) : "";
        normalized.username = message.username;
        normalized.role = message.role;
        normalized.time = message.time;
        if ((!normalized.text || !normalized.text.trim()) && !hasMedia) {
            safeCallback(callback, ClientError_1.ClientError.invalidError());
            return;
        }
        // Process the message or perform any necessary actions
        normalized.time = new Date().toISOString();
        // save — the model-normalized copy (media validated, text sanitized)
        const result = await repository.add(normalized);
        // Call the callback function to acknowledge the event
        safeCallback(callback, result);
        // Broadcast the chat message to all connected clients except the sender.
        // Parity contract with the Cloudflare build (roomdo.js): the broadcast
        // carries the SAVED message (id + sanitized text + validated media),
        // not the raw client payload — receivers (including the sender's other
        // devices) append it directly instead of falling into a resync.
        socket.broadcast.emit(SocketEvents_1.socketEvents.chatMessage, result);
    }
    catch (err) {
        log.error(err);
        safeCallback(callback, ClientError_1.ClientError.internalError());
    }
}
// Define the handler function for the "editMessage" event
async function handleEditMessage(updateMessage, socket, callback) {
    log.debug(`Received edit message: ${JSON.stringify(updateMessage)}`);
    try {
        if (!updateMessage?.id || !updateMessage?.text?.trim()) {
            safeCallback(callback, ClientError_1.ClientError.invalidError());
            return;
        }
        if (updateMessage.text.length > htmlSanitizer_1.MAX_MESSAGE_CHARS) {
            safeCallback(callback, ClientError_1.ClientError.tooLargeError());
            return;
        }
        // Get the repository
        const repository = (0, config_1.getMessageRepository)();
        // Get the message by id
        const message = await repository.find(updateMessage.id);
        if (!message) {
            safeCallback(callback, ClientError_1.ClientError.notExistsError());
            return;
        }
        const loggedInUser = socket.request.session.userInfo;
        if (message.username != loggedInUser.username) {
            safeCallback(callback, ClientError_1.ClientError.accessDeniedError());
            return;
        }
        message.text = (0, htmlSanitizer_1.sanitizeMessageHtml)(updateMessage.text);
        if (!message.text.trim()) {
            safeCallback(callback, ClientError_1.ClientError.invalidError());
            return;
        }
        message.edited_at = new Date().toISOString();
        // Update the message or perform any necessary actions
        const updatedMessage = await repository.update(message);
        // Call the callback function to acknowledge the event
        safeCallback(callback, updatedMessage);
        // Broadcast the edited message to all connected clients except the sender
        socket.broadcast.emit(SocketEvents_1.socketEvents.editedMessage, updatedMessage);
    }
    catch (err) {
        log.error(err);
        safeCallback(callback, ClientError_1.ClientError.internalError());
    }
}
// Define the handler function for the "reactMessage" event
async function handleReactMessage(reactedMessage, socket, callback) {
    log.debug(`Received reaction to message: ${JSON.stringify(reactedMessage)}`);
    try {
        if (!reactedMessage?.id)
            throw ClientError_1.ClientError.invalidError();
        // Get the repository
        const repository = (0, config_1.getMessageRepository)();
        // Get the message by id
        const message = await repository.find(reactedMessage.id);
        if (!message)
            throw ClientError_1.ClientError.invalidError();
        const curUserName = socket.request.session.userInfo.username;
        if (!message.reactions || typeof message.reactions !== "object")
            message.reactions = {};
        for (const emoji of Object.keys(reactedMessage.reactions || {})) {
            const incoming = reactedMessage.reactions[emoji];
            // tolerate malformed payloads
            if (!incoming || !Array.isArray(incoming.usernames))
                continue;
            if (!message.reactions[emoji] || !Array.isArray(message.reactions[emoji].usernames))
                message.reactions[emoji] = { usernames: [] };
            const userList = message.reactions[emoji].usernames;
            const foundUsr = incoming.usernames.find((usrname) => usrname == curUserName);
            const curUsr = userList.find((usrname) => usrname == curUserName);
            if (foundUsr && !curUsr)
                userList.push(curUserName);
            else if (!foundUsr && curUsr)
                message.reactions[emoji].usernames = userList.filter((usr) => usr != curUserName);
        }
        reactedMessage.reactions = message.reactions;
        // Update the message or perform any necessary actions
        await repository.update(message);
        // Call the callback function to acknowledge the event
        safeCallback(callback, reactedMessage);
        // Broadcast the edited message to all connected clients except the sender
        socket.broadcast.emit(SocketEvents_1.socketEvents.reactedMessage, reactedMessage);
    }
    catch (err) {
        log.error(err);
        safeCallback(callback, ClientError_1.ClientError.internalError());
    }
}
// Define the handler function for the "deleteChat" event
async function handleDeleteChat(socket, callback) {
    log.debug(`Received delete chat request.`);
    try {
        // owner request 2026-11-08: guarded FEATURE (deleteChatMode), not just
        // isAdmin — admins always can; mode/selected per the admin panel
        const setting = await (0, config_1.getSettingRepository)().get();
        const allowed = permissions_1.canDeleteAllChat(setting[0], socket.request.session.userInfo);
        if (!allowed) {
            safeCallback(callback, ClientError_1.ClientError.accessDeniedError());
            return;
        }
        // Get the repository
        const repository = (0, config_1.getMessageRepository)();
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        await repository.removeAll();
        // Call the callback function to acknowledge the event
        safeCallback(callback, "ok");
        // Broadcast the edited message to all connected clients except the sender
        socket.broadcast.emit(SocketEvents_1.socketEvents.chatDeleted);
    }
    catch (err) {
        log.error(err);
        safeCallback(callback, ClientError_1.ClientError.internalError());
    }
}
async function handleDeleteMessage(id, socket, callback) {
    try {
        if (!id) {
            safeCallback(callback, ClientError_1.ClientError.invalidError());
            return;
        }
        const loggedInUser = socket.request.session.userInfo;
        // get the repository
        const repository = (0, config_1.getMessageRepository)();
        const message = await repository.find(id);
        if (!message) {
            safeCallback(callback, { status: false });
            return;
        }
        // owner request 2026-11-08: a deleted single message drops its media too
        if (message.media && message.media.mediaId) {
            try {
                const mediaStore = require("../services/mediaStore.js");
                await mediaStore.removeMedia(message.media.mediaId);
            }
            catch (err) {
                log.error("media cleanup after delete failed:", err.message);
            }
        }
        if (message.username != loggedInUser.username && !loggedInUser.isAdmin) {
            safeCallback(callback, ClientError_1.ClientError.accessDeniedError());
            return;
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const result = await repository.remove(id);
        if (result) {
            log.debug(`Deleted message with id: ${id}`);
            // Broadcast the deleted message to all connected clients except the sender
            socket.broadcast.emit(SocketEvents_1.socketEvents.deletedMessage, id);
            safeCallback(callback, { status: true });
        }
        else {
            log.debug(`Failed to delete msg ${id}, as the id doesn't exist`);
            safeCallback(callback, { status: false });
        }
    }
    catch (err) {
        log.error(err);
        safeCallback(callback, { status: false, error: ClientError_1.ClientError.internalError() });
    }
}
async function handleUpdateNotice(socket, callback) {
    try {
        // only admins may trigger the notice refresh broadcast
        if (!socket.request.session.userInfo?.isAdmin) {
            safeCallback(callback, JSON.stringify({ success: false, error: "client_error.access_denied" }));
            return;
        }
        socket.broadcast.emit(SocketEvents_1.socketEvents.updateNotice);
        safeCallback(callback, JSON.stringify({ success: true }));
    }
    catch (err) {
        log.error(err);
        safeCallback(callback, JSON.stringify({ success: false }));
    }
}
 async function handleUpdateFsNotice(socket, callback) {
     try {
         // only admins may trigger the fullscreen-notice refresh broadcast
         if (!socket.request.session.userInfo?.isAdmin) {
             safeCallback(callback, JSON.stringify({ success: false, error: "client_error.access_denied" }));
             return;
         }
         socket.broadcast.emit(SocketEvents_1.socketEvents.updateFsNotice);
         safeCallback(callback, JSON.stringify({ success: true }));
     }
     catch (err) {
         log.error(err);
         safeCallback(callback, JSON.stringify({ success: false }));
     }
 }