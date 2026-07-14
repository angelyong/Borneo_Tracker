import { env } from '../config/env.js';
import type { EmailPayload } from './outbox.js';
import type { EmailMessage } from './provider.js';

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!);

export const renderEmail = (to: string, payload: EmailPayload): EmailMessage => {
  const name = escapeHtml(payload.firstName || 'there');
  const base = env.APP_PUBLIC_URL;
  const withLink = (subject: string, intro: string, path: string) => {
    if (!payload.token) throw new Error('EMAIL_TOKEN_MISSING');
    const url = `${base}${path}#token=${encodeURIComponent(payload.token)}`;
    return {
      to,
      subject,
      text: `Hello ${payload.firstName || 'there'},\n\n${intro}\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>Hello ${name},</p><p>${escapeHtml(intro)}</p><p><a href="${url}">Continue securely</a></p><p>If you did not request this, you can ignore this email.</p>`,
    };
  };
  switch (payload.action) {
    case 'VERIFY_EMAIL': return withLink('Verify your Borneo Tracker email', 'Verify your email to activate your Borneo Tracker account.', '/verify-email');
    case 'RESET_PASSWORD': return withLink('Reset your Borneo Tracker password', 'Use this link within 30 minutes to reset your password.', '/reset-password');
    case 'CONFIRM_EMAIL_CHANGE': return withLink('Confirm your new Borneo Tracker email', 'Sign in with your current email, then use this link within 30 minutes to confirm the change.', '/confirm-email-change');
    case 'PASSWORD_CHANGED': return { to, subject: 'Your Borneo Tracker password was changed', text: `Hello ${payload.firstName || 'there'},\n\nYour password was changed. If this was not you, contact support immediately.`, html: `<p>Hello ${name},</p><p>Your password was changed. If this was not you, contact support immediately.</p>` };
    case 'EMAIL_CHANGED': return { to, subject: 'Your Borneo Tracker email was changed', text: `Hello ${payload.firstName || 'there'},\n\nYour sign-in email was changed. If this was not you, contact support immediately.`, html: `<p>Hello ${name},</p><p>Your sign-in email was changed. If this was not you, contact support immediately.</p>` };
  }
};
