import { SoulRepository } from './soul-repository.ts';
import type { PrivacyTarget } from './soul-types.ts';
export declare function privacyRedact(repo: SoulRepository, target: PrivacyTarget, now: string): {
    memoryIds: string[];
    lifeIds: string[];
    scope: string;
};
