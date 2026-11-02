import type { Appraisal, Change, Projection } from './types.ts';
import { Store } from './store.ts';
export declare function change(store: Store, value: Omit<Change, 'id' | 'at'>, now: string): Change;
export declare function appraise(store: Store, value: Omit<Appraisal, 'id' | 'at'>, now: string): Appraisal;
export declare function project(store: Store, now: string): Projection;
