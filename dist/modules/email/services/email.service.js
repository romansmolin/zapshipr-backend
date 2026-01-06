"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodemailerEmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const get_env_var_1 = require("@/shared/utils/get-env-var");
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);
const parseBooleanEnv = (value) => {
    const normalized = value.trim().toLowerCase();
    if (TRUE_VALUES.has(normalized))
        return true;
    if (FALSE_VALUES.has(normalized))
        return false;
    throw new Error(`Invalid boolean environment value: ${value}`);
};
const parsePortEnv = (value) => {
    const port = Number(value);
    if (!Number.isInteger(port) || port <= 0) {
        throw new Error(`Invalid NODEMAILER_PORT value: ${value}`);
    }
    return port;
};
class NodemailerEmailService {
    constructor(logger) {
        this.logger = logger;
        this.senderEmail = (0, get_env_var_1.getEnvVar)('NODEMAILER_EMAIL');
        const transportOptions = {
            host: (0, get_env_var_1.getEnvVar)('NODEMAILER_HOST'),
            port: parsePortEnv((0, get_env_var_1.getEnvVar)('NODEMAILER_PORT')),
            secure: parseBooleanEnv((0, get_env_var_1.getEnvVar)('NODEMAILER_SECURE')),
            auth: {
                user: this.senderEmail,
                pass: (0, get_env_var_1.getEnvVar)('NODEMAILER_EMAIL_PASS'),
            },
        };
        this.transportConfig = {
            host: transportOptions.host,
            port: transportOptions.port,
            secure: transportOptions.secure,
        };
        this.transporter = nodemailer_1.default.createTransport(transportOptions);
    }
    generateEmailTemplate(name, message, email) {
        return `
            <html>
                <body>
                    <h1>Message From ${name || 'Not provided'}</h1>
                    <p><strong>Email:</strong> ${email || 'Not provided'}</p>
                    <p><strong>Message:</strong> ${message || 'Not provided'}</p>
                </body>
            </html>
        `;
    }
    async sendEmail(name, email, message) {
        try {
            const html = this.generateEmailTemplate(name, message, email);
            await this.transporter.sendMail({
                from: `"ZapShipr" <${this.senderEmail}>`,
                to: this.senderEmail,
                subject: `New Request Via Contact Form from ${email}`,
                html,
            });
        }
        catch (error) {
            this.logger.error('Failed to send email', {
                operation: 'sendEmail',
                error: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    stack: error instanceof Error ? error.stack : undefined,
                    code: error instanceof base_error_1.BaseAppError ? error.code : error_codes_const_1.ErrorCode.UNKNOWN_ERROR,
                },
            });
            if (error instanceof base_error_1.BaseAppError)
                throw error;
            throw new base_error_1.BaseAppError(`Failed to send email`, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async sendPasswordResetEmail(params) {
        const { to, name, resetLink, token } = params;
        const tokenReference = token.split('.')?.[0] ?? token;
        try {
            this.logger.info('Attempting to send password reset email', {
                operation: 'sendPasswordResetEmail',
                to,
                tokenReference,
                transport: this.transportConfig,
            });
            const html = `
                <html>
                    <body>
                        <p>Hi ${name || 'there'},</p>
                        <p>We received a request to reset your ZapShipr password. Click the button below to choose a new password:</p>
                        <p style="text-align:center;">
                            <a href="${resetLink}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a>
                        </p>
                        <p>If the button doesn't work, copy and paste this link into your browser:</p>
                        <p><a href="${resetLink}">${resetLink}</a></p>
                        <p>For security, your reset link is valid for the next hour. If you didn't request this, you can safely ignore this email.</p>
                        <hr />
                        <p style="font-size:12px;color:#6b7280;">Token reference: ${token}</p>
                    </body>
                </html>
            `;
            await this.transporter.sendMail({
                from: `"ZapShipr" <${this.senderEmail}>`,
                to,
                subject: 'Reset your ZapShipr password',
                html,
            });
            this.logger.info('Password reset email sent successfully', {
                operation: 'sendPasswordResetEmail',
                to,
                tokenReference,
            });
        }
        catch (error) {
            this.logger.error('Failed to send password reset email', {
                operation: 'sendPasswordResetEmail',
                to,
                tokenReference,
                transport: this.transportConfig,
                error: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    stack: error instanceof Error ? error.stack : undefined,
                    code: error instanceof base_error_1.BaseAppError ? error.code : error_codes_const_1.ErrorCode.UNKNOWN_ERROR,
                },
            });
            if (error instanceof base_error_1.BaseAppError)
                throw error;
            throw new base_error_1.BaseAppError(`Failed to send password reset email`, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async sendWaitlistConfirmationEmail(params) {
        const { to, referralLink } = params;
        try {
            this.logger.info('Attempting to send waitlist confirmation email', {
                operation: 'sendWaitlistConfirmationEmail',
                to,
                transport: this.transportConfig,
            });
            const html = `
                <html>
                    <body>
                        <p>You're on the ZapShipr waitlist.</p>
                        <p>Share your referral link to unlock 6 months free when 10 friends join:</p>
                        <p><a href="${referralLink}">${referralLink}</a></p>
                        <p>We'll email you when early access opens.</p>
                    </body>
                </html>
            `;
            await this.transporter.sendMail({
                from: `"ZapShipr" <${this.senderEmail}>`,
                to,
                subject: "You're on the ZapShipr waitlist",
                html,
            });
            this.logger.info('Waitlist confirmation email sent', {
                operation: 'sendWaitlistConfirmationEmail',
                to,
            });
        }
        catch (error) {
            this.logger.error('Failed to send waitlist confirmation email', {
                operation: 'sendWaitlistConfirmationEmail',
                to,
                transport: this.transportConfig,
                error: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    stack: error instanceof Error ? error.stack : undefined,
                    code: error instanceof base_error_1.BaseAppError ? error.code : error_codes_const_1.ErrorCode.UNKNOWN_ERROR,
                },
            });
            if (error instanceof base_error_1.BaseAppError)
                throw error;
            throw new base_error_1.BaseAppError(`Failed to send waitlist confirmation email`, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
}
exports.NodemailerEmailService = NodemailerEmailService;
