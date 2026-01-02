"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const body_parser_1 = __importDefault(require("body-parser"));
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const createApp = () => {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use(body_parser_1.default.urlencoded({ extended: true }));
    app.use(body_parser_1.default.json());
    app.use((0, cookie_parser_1.default)());
    const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:4040'];
    app.use((0, cors_1.default)({
        origin: defaultOrigins,
        credentials: true,
    }));
    return app;
};
exports.createApp = createApp;
