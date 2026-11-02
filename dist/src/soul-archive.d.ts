import { SoulRepository } from './soul-repository.ts';
import type { Payload } from './portable.ts';
import type { Lifecycle, LifeEntry, Stage } from './soul-types.ts';
export interface SoulPayload extends Omit<Payload, 'identity'> {
    identity: Payload['identity'] | null;
    lifecycle: Lifecycle;
    life: LifeEntry[];
    stage: {
        stage: Stage;
        at: string;
        eventId: string;
    } | null;
    queue: {
        id: string;
        done: number;
    }[];
}
export interface SoulArchive {
    format: 'soul-core';
    version: 2 | 3;
    exportedAt: string;
    checksum: string;
    payload: SoulPayload;
}
export declare const digest: (value: unknown) => string;
export declare function packSoul(repo: SoulRepository, now: string): SoulArchive;
export declare function validateSoulArchive(value: unknown): SoulArchive;
export declare function saveSoulArchive(archive: SoulArchive, path: string, password?: string): void;
export declare function loadSoulArchive(path: string, password?: string): SoulArchive;
