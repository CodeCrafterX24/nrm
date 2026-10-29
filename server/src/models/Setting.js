"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.initialFrequentSymbols = exports.Setting = void 0;
const BaseModel_1 = require("./BaseModel.js");
const initialFrequentSymbols = `
✋
আসসালামু আলাইকুম
ওয়ালাইকুমুস সালাম
<img src="https://" width="200" height="100" />
<b></b>
<i></i>
<a href="https://" target="_blank">name</a>
<figure><figcaption>Listen to the This:</figcaption><audio controls src="https://some_sound.mp3"></audio><a href="https://some_sound.mp3">Download audio</a></figure>
`;
exports.initialFrequentSymbols = initialFrequentSymbols;
class Setting extends BaseModel_1.BaseModel {
    notice;
    chatState;
    hijri;
    frequentSymbols;
    constructor(json = {}) {
        super(json);
        this.notice = json.notice || "";
        this.chatState = json.chatState ?? true; // by default chat should be enabled (|| would have forced true)
        this.hijri = {
            date: "",
            lastUpdate: "",
            adjustment: 0,
        };
        this.frequentSymbols = initialFrequentSymbols;
    }
}
exports.Setting = Setting;
