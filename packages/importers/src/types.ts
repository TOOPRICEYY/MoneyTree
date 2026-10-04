import type { Purchase, SourceId } from '@moneytree/core';

export type Importer = {
  source: SourceId;
  /** One line on where the data comes from, shown by `moneytree sources`. */
  description: string;
  /** Parses one export file (JSON, CSV, zip, email, image) into purchases. */
  parseFile: (path: string) => Promise<Purchase[]>;
};
