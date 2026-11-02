import { Store } from './store.ts';
import type { Appraisal, Change, Identity, Memory } from './types.ts';
export interface Payload {
    identity: Identity;
    memories: Memory[];
    changes: Change[];
    appraisals: Appraisal[];
}
export interface Portable {
    format: 'memory-core';
    version: 1;
    exportedAt: string;
    checksum: string;
    payload: Payload;
}
export declare function pack(store: Store, now: string): Portable;
export declare function validatePackage(value: unknown): Portable;
export declare function unpack(store: Store, archive: Portable): Identity;
export declare function savePackage(packet: Portable, path: string, password?: string): void;
export declare function loadPackage(path: string, password?: string): Portable;
