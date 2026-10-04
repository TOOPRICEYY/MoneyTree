import type { EmailQuery, RawDocument, SourceId } from '@moneytree/core';
import { simpleParser } from 'mailparser';

import type { RawEmail } from './types.ts';

export async function toEmailDocument(
  source: SourceId,
  email: RawEmail,
): Promise<RawDocument> {
  const parsed = await simpleParser(email.source);
  return {
    source,
    channel: 'email',
    kind: 'email',
    id: parsed.messageId ?? email.providerId,
    fetchedAt: new Date().toISOString(),
    receivedAt: (parsed.date ?? new Date()).toISOString(),
    from: parsed.from?.value[0]?.address ?? '',
    subject: parsed.subject ?? '',
    html: parsed.html === false ? undefined : parsed.html,
    text: parsed.text,
    attachments: parsed.attachments.map(attachment => ({
      filename: attachment.filename ?? 'attachment',
      mimeType: attachment.contentType,
      contentBase64: attachment.content.toString('base64'),
    })),
  };
}

/**
 * Exact check applied after every provider search: Gmail's search is fuzzy
 * and IMAP can only filter on one subject string.
 */
export function matchesQuery(
  doc: { from: string; subject: string },
  query: EmailQuery,
): boolean {
  const from = doc.from.toLowerCase();
  const subject = doc.subject.toLowerCase();
  const isFromSender = query.from.some(sender => {
    const s = sender.toLowerCase();
    return s.includes('@')
      ? from === s
      : from.endsWith(`@${s}`) || from.endsWith(`.${s}`);
  });
  const hasSubject = (query.subject ?? []).every(word =>
    subject.includes(word.toLowerCase()),
  );
  return isFromSender && hasSubject;
}
