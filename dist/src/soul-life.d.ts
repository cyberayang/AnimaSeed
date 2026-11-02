import { SoulRepository } from './soul-repository.ts';
import type { Observation, Memory } from './types.ts';
import type { LifeEntry, LifeInput, SourceRef } from './soul-types.ts';
export declare function requireLiving(repo: SoulRepository): void;
export declare function observeLife(repo: SoulRepository, value: Omit<Observation, 'at'>, now: string): Memory;
export declare function ancestry(repo: SoulRepository, refs: SourceRef[]): {
    memories: Memory[];
    entries: LifeEntry[];
};
export declare function authorLife(repo: SoulRepository, input: LifeInput, now: string): LifeEntry;
