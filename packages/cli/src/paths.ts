import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Repo root; config and local data live here regardless of cwd. */
export const ROOT = resolve(import.meta.dirname, '../../..');
/** Where the user ran `yarn moneytree`, for resolving file arguments. */
export const INVOKED_FROM = process.env.INIT_CWD ?? process.cwd();

export const DATA_DIR = resolve(ROOT, 'data');
export const RAW_DIR = resolve(DATA_DIR, 'raw');
export const STATE_DIR = resolve(DATA_DIR, 'state');
export const CREDENTIALS_DIR = resolve(DATA_DIR, 'credentials');
export const BROWSER_PROFILE_DIR = resolve(DATA_DIR, 'browser-profile');

export function loadEnv() {
  const envFile = resolve(ROOT, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}
