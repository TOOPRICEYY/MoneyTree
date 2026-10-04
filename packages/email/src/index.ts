export { fetchEmails } from './fetchEmails.ts';
export {
  buildGmailQuery,
  getGmailAccessToken,
  gmailProvider,
} from './gmail.ts';
export type { GmailCredentials } from './gmail.ts';
export { authorizeGmail } from './gmailAuth.ts';
export type { GmailClient } from './gmailAuth.ts';
export { buildImapSearch, imapProvider } from './imap.ts';
export type { ImapConfig } from './imap.ts';
export { matchesQuery, toEmailDocument } from './parse.ts';
export type { EmailProvider, RawEmail } from './types.ts';
