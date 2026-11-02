import { Store } from './store.ts';
import type { RecallHit } from './types.ts';
export declare function recall(store: Store, query: string, now: string, limit?: number): RecallHit[];
