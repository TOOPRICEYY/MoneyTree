import type {
  BankTransaction,
  Cents,
  IsoDate,
  Purchase,
  SourceId,
} from './types.ts';

// Contract between the local API server and the web UI. Types only, so the
// browser bundle can import them without pulling in Node code.

/** A way to get data for a source, as offered by the fetch command. */
export type FetchChannel = 'email' | 'scrape' | 'knot';

export type ChannelStatus = {
  channel: FetchChannel | 'file';
  /** Data can be downloaded through this channel today. */
  canFetch: boolean;
  /** Downloaded data can be turned into purchases today. */
  canParse: boolean;
};

export type SourceInfo = {
  source: SourceId;
  description: string;
  channels: ChannelStatus[];
  rawDocumentCount: number;
  lastFetchedAt?: string;
};

export type SplitPreview = {
  amount: Cents;
  memo: string;
};

export type MatchPreview = {
  bankTransaction: BankTransaction;
  purchase: Purchase;
  score: number;
  dayDelta: number;
  amountDelta: Cents;
  /** Exactly what `apply` would write, already balanced to the bank amount. */
  splits: SplitPreview[];
};

export type ReviewResult = {
  since: IsoDate;
  matches: MatchPreview[];
  unmatched: Purchase[];
};

export type JobStatus = 'running' | 'done' | 'failed';

export type Job = {
  id: string;
  label: string;
  status: JobStatus;
  startedAt: string;
  finishedAt?: string;
  log: string[];
  error?: string;
};
