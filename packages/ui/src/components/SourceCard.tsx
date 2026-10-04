import type {
  FetchChannel,
  IsoDate,
  SourceId,
  SourceInfo,
} from '@moneytree/core';

import { formatRelative, sourceLabel } from '../format.ts';
import { useMoneyTree } from '../MoneyTreeProvider.tsx';

import { Notice } from './Notice.tsx';
import { useStartJob } from './useStartJob.ts';

const CHANNEL_LABELS: Record<FetchChannel | 'file', string> = {
  email: 'Email',
  scrape: 'Browser',
  knot: 'Knot',
  file: 'File',
};

type SourceCardProps = {
  info: SourceInfo;
  since: IsoDate;
};

export function SourceCard({ info, since }: SourceCardProps) {
  const { client, linkTo } = useMoneyTree();
  const startFetch = useStartJob(
    (args: { source: SourceId; via: FetchChannel }) =>
      client.fetch(args.source, args.via, since),
  );
  const canParseAny = info.channels.some(c => c.canParse);

  return (
    <article className="card">
      <header className="card-header">
        <h2>{sourceLabel(info.source)}</h2>
        <span className="count-pill">
          {info.rawDocumentCount}{' '}
          {info.rawDocumentCount === 1 ? 'document' : 'documents'}
        </span>
      </header>
      <p className="muted">{info.description}</p>
      <p className="meta">
        {info.lastFetchedAt
          ? `Last fetched ${formatRelative(info.lastFetchedAt)}`
          : 'Nothing fetched yet'}
      </p>

      <ul className="channels" aria-label="Channels">
        {info.channels.map(channel => (
          <li key={channel.channel}>
            {channel.channel === 'file' ? (
              <span className="chip">{CHANNEL_LABELS.file}</span>
            ) : (
              <button
                type="button"
                className="chip chip-action"
                disabled={startFetch.isPending}
                onClick={() => {
                  if (channel.channel !== 'file') {
                    startFetch.mutate({
                      source: info.source,
                      via: channel.channel,
                    });
                  }
                }}
              >
                Fetch via {CHANNEL_LABELS[channel.channel]}
              </button>
            )}
            {!channel.canParse && (
              <span className="chip chip-planned">parser planned</span>
            )}
          </li>
        ))}
      </ul>

      {startFetch.error && (
        <Notice tone="error">{startFetch.error.message}</Notice>
      )}

      {canParseAny && (
        <footer className="card-footer">
          <a href={linkTo({ page: 'purchases', source: info.source })}>
            View purchases
          </a>
          <a href={linkTo({ page: 'review', source: info.source })}>
            Review matches
          </a>
        </footer>
      )}
    </article>
  );
}
