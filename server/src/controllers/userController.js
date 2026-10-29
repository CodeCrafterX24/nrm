"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.updateSoundPref = exports.updateLangPref = exports.unsuspendUser = exports.suspendUser = exports.removeUser = exports.makeUserRegular = exports.makeUserAdmin = exports.getUsers = exports.getLoggedInUserInfo = exports.changePassword = exports.addUser = void 0;
const logger_1 = __importDefault(require("../logger.js"));
const UserDto_1 = require("../dto/UserDto.js");
const ClientError_1 = require("../models/ClientError.js");
const userCrudService = __importStar(require("../services/userCrudService.js"));
const log = (0, logger_1.default)(__filename);
const getLoggedInUserInfo = async (req, res) => {
    res.json(req.session.userInfo);
};
exports.getLoggedInUserInfo = getLoggedInUserInfo;
const addUser = async (req, res) => {
    try {
        // Sanitize the input data
        const sanitizedUserDto = sanitizeUserDto(req.body);
        await userCrudService.addUser(sanitizedUserDto);
        res.sendStatus(200);
    }
    catch (error) {
        if (error instanceof ClientError_1.ClientError) {
            res.status(400).json({
                message: error.message,
            });
        }
        else {
            log.error(error);
            res.sendStatus(500);
        }
    }
};
exports.addUser = addUser;
function sanitizeUserDto(userDto) {
    // Sanitize the input data to prevent potential security vulnerabilities
    const sanitizedUserDto = new UserDto_1.UserDto({
        username: typeof userDto.username === 'string' ? userDto.username.trim().slice(0, 50) : '',
        password: typeof userDto.password === 'string' ? userDto.password.trim().slice(0, 100) : '',
        // Add more sanitization logic for other properties as needed
    });
    return sanitizedUserDto;
}
const getUsers = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin) {
        res.sendStatus(403);
        return;
    }
    log.debug("Getting users...");
    try {
        // keeping here to handle errors if any
        const users = await userCrudService.getUsers();
        // never leak password hashes to clients
        res.status(200).json(users.map((u) => (u.toSafeJson ? u.toSafeJson() : u)));
    }
    catch (error) {
        if (error instanceof ClientError_1.ClientError) {
            res.status(400).json({
                message: error.message,
            });
        }
        else {
            log.error(error);
            res.sendStatus(500);
        }
    }
};
exports.getUsers = getUsers;
const removeUser = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin) {
        res.sendStatus(403);
        return;
    }
    log.debug("Removing user...");
    const userId = Number(req.params.id);
    try {
        // keeping here to handle errors if any
        await userCrudService.removeUser(userId);
        log.debug("User removed successfully.");
        res.sendStatus(200);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.removeUser = removeUser;
const makeUserAdmin = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin) {
        res.sendStatus(403);
        return;
    }
    log.debug("Making user admin...");
    const userId = Number(req.params.id);
    try {
        // keeping here to handle errors if any
        const updateUser = await userCrudService.makeUserAdmin(userId);
        log.debug("User made admin successfully.");
        res.status(200).json(updateUser.toSafeJson ? updateUser.toSafeJson() : updateUser);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.makeUserAdmin = makeUserAdmin;
const makeUserRegular = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin) {
        res.sendStatus(403);
        return;
    }
    log.debug("Making user regular...");
    const userId = Number(req.params.id);
    try {
        // keeping here to handle errors if any
        const updateUser = await userCrudService.makeUserRegular(userId);
        log.debug("User made regular successfully.");
        res.status(200).json(updateUser.toSafeJson ? updateUser.toSafeJson() : updateUser);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.makeUserRegular = makeUserRegular;
const suspendUser = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin) {
        res.sendStatus(403);
        return;
    }
    log.debug("Suspending user...");
    const userId = Number(req.params.id);
    try {
        // keeping here to handle errors if any
        const updateUser = await userCrudService.suspendUser(userId);
        log.debug("User suspended successfully.");
        res.status(200).json(updateUser.toSafeJson ? updateUser.toSafeJson() : updateUser);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.suspendUser = suspendUser;
const unsuspendUser = async (req, res) => {
    if (!req.session?.userInfo?.isAdmin) {
        res.sendStatus(403);
        return;
    }
    log.debug("Unsuspending user...");
    const userId = Number(req.params.id);
    try {
        // keeping here to handle errors if any
        const updateUser = await userCrudService.unsuspendUser(userId);
        log.debug("User unsuspended successfully.");
        res.status(200).json(updateUser.toSafeJson ? updateUser.toSafeJson() : updateUser);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.unsuspendUser = unsuspendUser;
const changePassword = async (req, res) => {
    try {
        const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : undefined;
        const userDto = new UserDto_1.UserDto(req.body);
        userDto.username = req.session?.userInfo?.username;
        if (!userDto.password?.trim())
            return res.sendStatus(400);
        userDto.password = userDto.getPasswordHash();
        const updatedUser = await userCrudService.changePassword(userDto, currentPassword);
        // flag cleared both in the store and in the live session
        req.session.userInfo.mustChangePassword = false;
        log.debug("Password updated successfully.");
        res.status(200).json(updatedUser.toSafeJson ? updatedUser.toSafeJson() : updatedUser);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.changePassword = changePassword;
const updateSoundPref = async (req, res) => {
    try {
        const userDto = new UserDto_1.UserDto(req.body);
        userDto.username = req.session?.userInfo?.username;
        const updatedUser = await userCrudService.updateSoundPref(userDto);
        // update the soundPref to session
        req.session.userInfo.soundPref = updatedUser.soundPref;
        log.debug("SoundPref updated successfully.");
        res.status(200).json(updatedUser);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.updateSoundPref = updateSoundPref;
const updateLangPref = async (req, res) => {
    try {
        const userDto = new UserDto_1.UserDto(req.body);
        userDto.username = req.session?.userInfo?.username;
        const updatedUser = await userCrudService.updateLangPref(userDto);
        // update the langPref to session
        req.session.userInfo.langPref = updatedUser.langPref;
        log.debug("LangPref updated successfully.");
        res.status(200).json(updatedUser);
    }
    catch (error) {
        handleError(error, res);
    }
};
exports.updateLangPref = updateLangPref;
/**
 * Handles errors and sends appropriate HTTP responses.
 *
 * @param error - The error object to handle.
 * @param res - The HTTP response object to send the response.
 */
const handleError = (error, res) => {
    if (error instanceof ClientError_1.ClientError) {
        // Handle client errors with a 400 Bad Request status code
        res.status(400).json({ message: error.message });
    }
    else {
        // Log other errors and send a generic 500 Internal Server Error status code
        log.error(error);
        res.sendStatus(500);
    }
};
