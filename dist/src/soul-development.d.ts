import type { Development, Stage } from './soul-types.ts';
import { SoulRepository } from './soul-repository.ts';
export declare const STAGE_LABELS: Record<Stage, string>;
export declare function development(repo: SoulRepository, now: string): Development;
export declare function advance(repo: SoulRepository, now: string): Development;
