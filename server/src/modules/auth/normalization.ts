import { domainToASCII } from 'node:url';

export const normalizeEmail = (input: string) => {
  const trimmed = input.trim();
  if (/\p{Cc}/u.test(trimmed)) throw new Error('CONTROL_CHARACTER');
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return trimmed.toLowerCase();
  const local = trimmed.slice(0, at).toLowerCase();
  const domain = domainToASCII(trimmed.slice(at + 1).toLowerCase());
  return `${local}@${domain}`;
};
