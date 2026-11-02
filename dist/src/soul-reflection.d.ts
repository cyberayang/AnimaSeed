import { SoulRepository } from './soul-repository.ts';
import type { SoulReflectionInput } from './soul-types.ts';
export declare function reflectionInput(repo: SoulRepository, now: string): SoulReflectionInput;
export declare function applyReflection(repo: SoulRepository, value: unknown, input: SoulReflectionInput, now: string): {
    entries: import("./soul-types.ts").LifeEntry[];
    growth: import("./soul-types.ts").LifeEntry[];
    reviews: import("./soul-types.ts").LifeEntry[];
    intentions: import("./soul-types.ts").LifeEntry[];
};
