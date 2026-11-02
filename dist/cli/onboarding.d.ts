import type { SoulCore } from '../src/index.ts';
export declare function onboard(soul: SoulCore, ask: (prompt: string) => Promise<string>): Promise<{
    lifecycle: import("../src/soul-types.ts").Lifecycle;
    development: import("../src/soul-types.ts").Development;
    interests: import("../src/soul-types.ts").LifeEntry[];
    preferences: import("../src/soul-types.ts").LifeEntry[];
    understandings: import("../src/soul-types.ts").LifeEntry[];
    affect: {
        valence: number;
        arousal: number;
        trust: number;
        kind: 'simulated-state';
    };
}>;
export declare function startOnboarding(soul: SoulCore): Promise<void>;
