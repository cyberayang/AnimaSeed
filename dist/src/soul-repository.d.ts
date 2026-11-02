import { Store } from './store.ts';
import type { LifeEntry, LifeKind, SourceRef, Lifecycle } from './soul-types.ts';
export declare class SoulRepository {
    readonly store: Store;
    constructor(store: Store);
    lifecycle(): Lifecycle;
    revision(): number;
    changed(): void;
    enqueue(id: string): void;
    get(id: string): LifeEntry | undefined;
    all(): LifeEntry[];
    list(kind?: LifeKind, limit?: number): LifeEntry[];
    current(kind: LifeKind, limit?: number): LifeEntry[];
    historical(id: string): boolean;
    source(ref: SourceRef): {
        text: string;
        at: string;
        role: string;
    };
    validateSources(refs: SourceRef[], now: string): void;
    put(row: LifeEntry): LifeEntry;
    search(query: string, limit?: number): LifeEntry[];
}
