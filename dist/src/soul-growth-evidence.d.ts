import { SoulRepository } from './soul-repository.ts';
import type { GrowthSampleInput, GrowthReviewInput, LifeEntry, SourceRef } from './soul-types.ts';
export declare const refTo: (row: LifeEntry) => SourceRef;
export declare function growthSample(repo: SoulRepository, input: GrowthSampleInput, now: string): LifeEntry;
export declare function growthReview(repo: SoulRepository, input: GrowthReviewInput, now: string): LifeEntry;
