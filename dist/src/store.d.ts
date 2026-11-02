import { DatabaseSync } from 'node:sqlite';
import type { Appraisal, Change, Identity, Memory, MemoryKind, Status } from './types.ts';
export declare class Store {
    readonly db: DatabaseSync;
    readonly directory: string;
    constructor(directory: string, supportedVersion?: number);
    transaction<T>(operation: () => T): T;
    identity(): Identity | undefined;
    meta<T>(key: string): T | undefined;
    setMeta(key: string, value: unknown): void;
    setIdentity(value: Identity): void;
    get(id: string): Memory | undefined;
    byExternalKey(key: string): Memory | undefined;
    all(status?: Status): Memory[];
    recent(limit?: number): Memory[];
    category(kind: MemoryKind, limit: number): Memory[];
    pinned(limit: number): Memory[];
    put(record: Memory): void;
    dependents(ids: string[]): string[];
    values<T extends Change | Appraisal>(table: 'changes' | 'appraisals'): T[];
    addState(table: 'changes' | 'appraisals', value: Change | Appraisal): void;
    audit(kind: string, targets: string[], at: string): void;
    close(): void;
}
