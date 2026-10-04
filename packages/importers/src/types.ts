import type {
  EmailQuery,
  Purchase,
  RawDocument,
  SourceId,
} from '@moneytree/core';

export type Importer = {
  source: SourceId;
  /** One line on what this importer reads, shown by `moneytree sources`. */
  description: string;
  /** How to find this source's receipts by email, if it sends them. */
  emailQuery?: EmailQuery;
  /** True while the parser is a stub. */
  isPlanned?: boolean;
  /** Parses one raw document from any channel into purchases. */
  parse: (doc: RawDocument) => Promise<Purchase[]>;
};
