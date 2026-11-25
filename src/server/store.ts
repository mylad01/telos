import { DATA_DIR } from './data-dir';
import * as json from './store-json';
import * as sqlite from './store-sqlite';
import type { Store, SyncResult } from './store-types';

export { DATA_DIR };
export type { SyncResult };

/**
 * `TELOS_STORE=sqlite` switches the backend; JSON stays the default until the
 * SQLite path has run a full release cycle. Both implement the same contract,
 * so the API routes do not know which one is live.
 */
export const STORE_KIND: 'json' | 'sqlite' = process.env.TELOS_STORE === 'sqlite' ? 'sqlite' : 'json';

const store: Store = STORE_KIND === 'sqlite' ? sqlite : json;

export const createAccount = store.createAccount;
export const verifyAccount = store.verifyAccount;
export const syncTasks = store.syncTasks;
export const listTasks = store.listTasks;
