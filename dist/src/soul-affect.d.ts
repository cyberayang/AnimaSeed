import { SoulRepository } from './soul-repository.ts';
import type { SoulSnapshot } from './soul-types.ts';
/** Engineering state projection, not a claim of subjective feelings. */
export declare function affectState(repo: SoulRepository, now: string): SoulSnapshot['affect'];
