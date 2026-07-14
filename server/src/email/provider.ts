import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export type EmailMessage = { to: string; subject: string; text: string; html: string };
export interface EmailProvider { send(message: EmailMessage, idempotencyKey: string): Promise<string>; }

class SmtpEmailProvider implements EmailProvider {
  private readonly transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.isProduction && env.SMTP_PORT !== 465,
    tls: env.isProduction ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
    ...(env.SMTP_USER && env.SMTP_PASSWORD ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 25_000,
  });
  async send(message: EmailMessage) {
    const result = await this.transport.sendMail({ from: env.EMAIL_FROM, ...message });
    return String(result.messageId).slice(0, 255);
  }
}

class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage, idempotencyKey: string) {
    console.info(JSON.stringify({ level: 'info', event: 'EMAIL_PREVIEW', to: message.to, subject: message.subject, idempotencyKey }));
    return `console-${idempotencyKey}`;
  }
}

export const emailProvider: EmailProvider = env.EMAIL_PROVIDER === 'smtp' ? new SmtpEmailProvider() : new ConsoleEmailProvider();
