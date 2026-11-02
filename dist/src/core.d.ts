import type { Appraisal, Change, Citation, Consolidator, DerivedInput, Identity, Observation } from './types.ts';
import type { Portable } from './portable.ts';
export interface CoreOptions {
    dataDir: string;
    name?: string;
    principles?: string[];
    clock?: () => Date;
}
export declare class MemoryCore {
    #private;
    constructor(options: CoreOptions);
    now(): string;
    get dataDir(): string;
    identity(): Identity;
    observe(input: Observation): import("./types.ts").Memory;
    remember(input: DerivedInput): import("./types.ts").Memory;
    get(id: string): import("./types.ts").Memory | undefined;
    records(): import("./types.ts").Memory[];
    recall(query: string, limit?: number): import("./types.ts").RecallHit[];
    context(query: string, maxChars?: number): import("./types.ts").ContextPacket;
    state(): import("./types.ts").Projection;
    change(input: Omit<Change, 'id' | 'at'>): Change;
    appraise(input: Omit<Appraisal, 'id' | 'at'>): Appraisal;
    correct(id: string, replacement: string, citations: Citation[]): import("./types.ts").Memory;
    forget(id: string): {
        forgottenIds: string[];
        scope: string;
    };
    sleep(): {
        memories: string[];
        changes: string[];
        appraisals: string[];
        stale: string[];
        expired: string[];
    };
    consolidate(consolidator: Consolidator, signal?: AbortSignal): Promise<{
        memories: import("./types.ts").Memory[];
        changes: Change[];
        appraisals: Appraisal[];
    }>;
    export(): Portable;
    static restore(packet: unknown, options: Omit<CoreOptions, 'name' | 'principles'>): MemoryCore;
    status(): {
        version: number;
        identity: Identity;
        memories: Record<string, import("node:sqlite").SQLOutputValue>[];
        dataDir: string;
    };
    close(): void;
}
