"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.restoreFrequentSymbols = exports.saveFrequentSymbols = exports.getFrequentSymbols = exports.saveAdjustedHijri = exports.getHijriAdjustment = exports.deleteChat = exports.canWeChat = exports.disableChat = exports.enableChat = exports.downloadFormatted = exports.downloadChat = exports.updateNotice = exports.getNotice = void 0;
exports.getHijri = getHijri;
const logger_1 = __importDefault(require("../logger.js"));
const ClientError_1 = require("../models/ClientError.js");
const ChatService_1 = require("../services/chatService.js");
const config_1 = require("../config/repositoryFactory.js");
const Setting_1 = require("../models/Setting.js");
const SettingService_1 = require("../services/settingService.js");
const htmlSanitizer_1 = require("../services/htmlSanitizer.js");
const log = (0, logger_1.default)(__filename);
/** the settings store may still be initializing at boot — fail softly instead of crashing */
async function getSetting() {
    const settings = await (0, config_1.getSettingRepository)().get();
    const setting = settings[0];
    if (!setting)
        throw ClientError_1.ClientError.connectionFailedError();
    return setting;
}
const getNotice = async (req, res) => {
    try {
        const setting = await getSetting();
        res.status(200).json({ notice: setting.notice });
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.getNotice = getNotice;
const getFrequentSymbols = async (req, res) => {
    try {
        const setting = await getSetting();
        res.status(200).json({ frequentSymbols: setting.frequentSymbols });
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.getFrequentSymbols = getFrequentSymbols;
const saveFrequentSymbols = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    try {
        const repository = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        setting.frequentSymbols = typeof req.body.frequentSymbols === "string" ? req.body.frequentSymbols.slice(0, 20000) : "";
        await repository.update(setting);
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.saveFrequentSymbols = saveFrequentSymbols;
const restoreFrequentSymbols = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    try {
        const repository = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        setting.frequentSymbols = Setting_1.initialFrequentSymbols;
        await repository.update(setting);
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.restoreFrequentSymbols = restoreFrequentSymbols;
const updateNotice = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    log.debug("updating notice");
    try {
        const repository = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        // HTML+CSS notice is supported — sanitized server-side, length-capped
        setting.notice = (0, htmlSanitizer_1.sanitizeNoticeHtml)(typeof req.body?.notice === "string" ? req.body.notice.slice(0, htmlSanitizer_1.MAX_NOTICE_CHARS) : "");
        await repository.update(setting);
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.updateNotice = updateNotice;
const enableChat = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    log.debug("enabling chat");
    try {
        const repository = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        setting.chatState = true;
        await repository.update(setting);
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.enableChat = enableChat;
const disableChat = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    log.debug("disabling chat");
    try {
        const repository = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        setting.chatState = false;
        await repository.update(setting);
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.disableChat = disableChat;
const canWeChat = async (req, res) => {
    try {
        const setting = await getSetting();
        const peopleCanChat = setting.chatState;
        res.status(200).json({ peopleCanChat });
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.canWeChat = canWeChat;
const deleteChat = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    log.debug("Deleting all messages...");
    try {
        await (0, ChatService_1.deleteAllChat)(res);
        log.debug("all messages deleted successfully.");
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.deleteChat = deleteChat;
const downloadChat = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    log.debug("Downloading all messages...");
    try {
        await (0, ChatService_1.downloadJson)(res);
        log.debug("all messages downloaded successfully.");
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.downloadChat = downloadChat;
const downloadFormatted = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    log.debug("Downloading all messages...");
    try {
        const messages = await (0, ChatService_1.downloadAll)();
        log.debug("all messages downloaded successfully.");
        res.status(200).json(messages);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.downloadFormatted = downloadFormatted;
async function getHijri(req, res) {
    try {
        const hijri = await (0, SettingService_1.getHijriDate)();
        res.status(200).json({ hijri });
    }
    catch (error) {
        handleError(error, res);
    }
}
const getHijriAdjustment = async (req, res) => {
    try {
        const setting = await getSetting();
        res.status(200).json({ adjustment: setting.hijri?.adjustment ?? 0 });
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.getHijriAdjustment = getHijriAdjustment;
const saveAdjustedHijri = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin)
        return res.sendStatus(403);
    try {
        const settingRepo = (0, config_1.getSettingRepository)();
        const setting = await getSetting();
        const adjusted = Number(req.body?.adjustedNumber);
        if (Number.isNaN(adjusted) || adjusted < -30 || adjusted > 30)
            return res.sendStatus(400);
        setting.hijri.adjustment = adjusted;
        // recompute immediately so the header shows the adjusted date right away
        setting.hijri.lastUpdate = "";
        await settingRepo.update(setting);
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.saveAdjustedHijri = saveAdjustedHijri;
/**
 * Handles errors and sends appropriate HTTP responses.
 *
 * @param error - The error object to handle.
 * @param res - The HTTP response object to send the response.
 */
const handleError = (error, res) => {
    if (error instanceof ClientError_1.ClientError) {
        // Handle client errors with a 400 Bad Request status code
        res.status(400).send({ errorMessage: error.message });
    }
    else {
        // Log other errors and send a generic 500 Internal Server Error status code
        log.error(error);
        res.sendStatus(500);
    }
};
