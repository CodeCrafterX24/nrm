"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const logger_1 = __importDefault(require("../logger.js"));
const UserDto_1 = require("../dto/UserDto.js");
const Setting_1 = require("../models/Setting.js");
const User_1 = require("../models/User.js");
const config_1 = require("../config/repositoryFactory.js");
// boot-time message-store mode: the admin's saved switch (Setting doc) is
// applied after the repos exist — see initializeSettingAndUser below
const log = (0, logger_1.default)(__filename);
const initializeSetting = async () => {
    const repository = (0, config_1.getSettingRepository)();
    const settings = await repository.get();
    if (settings && settings.length) {
        return;
    }
    const initalData = {
        id: 1,
        chatState: true,
        notice: "",
        hijri: {
            date: "",
            lastUpdate: "",
            adjustment: 0,
        },
        frequentSymbols: Setting_1.initialFrequentSymbols,
    };
    await repository.add(initalData);
};
const insertDummyAdminUser = async () => {
    try {
        const users = await (0, config_1.getUserRepository)().get();
        const user = users.filter((user) => user.isSuperAdmin === true); // check if super admin exists
        if (user.length > 0)
            return; // admin id already exists
        log.info("creating admin user!");
        // creating dto instance because password hash function is not available at model
        const adminUserDto = new UserDto_1.UserDto({
            username: "Admin",
            password: "Admin@789",
        });
        adminUserDto.password = adminUserDto.getPasswordHash(); // password hash is generated
        // now create instance of the model with the dto that contains hashed password
        const adminUserModel = new User_1.User(adminUserDto);
        adminUserModel.active = true; // set active
        adminUserModel.isAdmin = true; // set isAdmin
        adminUserModel.isSuperAdmin = true; // set isSuperAdmin
        // the default password is hardcoded by design — force a change on first login
        adminUserModel.mustChangePassword = true;
        const result = await (0, config_1.getUserRepository)().add(adminUserModel); // insert
        log.debug(JSON.stringify(result));
    }
    catch (error) {
        // Handle the error here
        log.error("Error occurred during dummy admin user creation:", error);
    }
};
async function initializeSettingAndUser() {
    // Boot hardening (owner-reported 2026-11-07: wrong/new encryption_password
    // made the Setting gist load fail all 8 attempts -> this promise rejected
    // unhandled -> the process exited -> Render restart-looped -> EVERY request
    // 502'd, including the first Admin login). Storage problems must never take
    // the whole server down: log loudly, keep serving, retry on demand — every
    // later get() call re-enters ensureLoaded() and retries the load anyway.
    try {
        await initializeSetting();
        await insertDummyAdminUser();
    }
    catch (err) {
        log.error("boot storage init failed (server stays up; reads/writes will retry):", err.message);
    }
    // apply the admin's saved message-store switch (gist | memory) at boot
    try {
        const settings = await config_1.getSettingRepository().get();
        const mode = settings[0]?.messageStoreMode === "gist" ? "gist" : "memory";
        config_1.applyMessageStoreMode(mode);
    }
    catch (err) {
        log.error("applying saved message-store mode failed:", err);
    }
}
initializeSettingAndUser();
