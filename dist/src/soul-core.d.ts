import type { NamingInput } from './soul-lifecycle.ts';
import type { SoulContextOptions } from './soul-context.ts';
import type { Observation } from './types.ts';
import type { LifeInput, GrowthSampleInput, GrowthReviewInput, PrivacyTarget, SoulReflector } from './soul-types.ts';
import type { IntentionInput, HostPermissionInput, HostExperienceInput } from './agency-types.ts';
export interface SoulOptions {
    dataDir: string;
    clock?: () => Date;
}
export declare class SoulCore {
    #private;
    constructor(options: SoulOptions);
    now(): string;
    get dataDir(): string;
    lifecycle(): import("./soul-types.ts").Lifecycle;
    revision(): number;
    maintenance(): {
        pending: number;
        usage: {
            day: string;
            count: number;
        };
    };
    name(input: NamingInput): import("./soul-types.ts").Lifecycle;
    adoptLegacy(confirmed: boolean): import("./soul-types.ts").Lifecycle;
    observe(input: Omit<Observation, 'at'>): import("./types.ts").Memory;
    reply(input: {
        sessionId: string;
        messageId: string;
        text: string;
        inReplyTo: string;
    }): import("./types.ts").Memory;
    record(input: LifeInput): import("./soul-types.ts").LifeEntry;
    intend(input: IntentionInput): import("./soul-types.ts").LifeEntry;
    intentions(limit?: number): import("./agency-types.ts").IntentionView[];
    hostPermission(input: HostPermissionInput): import("./soul-types.ts").LifeEntry;
    hostExperience(input: HostExperienceInput): import("./soul-types.ts").LifeEntry;
    idle(): {
        kind: string;
        rules: string;
        context: import("./types.ts").ContextPacket;
        intentions: import("./agency-types.ts").IntentionView[];
    };
    proposeGrowth(input: GrowthSampleInput): import("./soul-types.ts").LifeEntry;
    reviewGrowth(input: GrowthReviewInput): import("./soul-types.ts").LifeEntry;
    state(): {
        lifecycle: import("./soul-types.ts").Lifecycle;
        development: import("./soul-types.ts").Development;
        interests: import("./soul-types.ts").LifeEntry[];
        preferences: import("./soul-types.ts").LifeEntry[];
        understandings: import("./soul-types.ts").LifeEntry[];
        affect: {
            valence: number;
            arousal: number;
            trust: number;
            kind: 'simulated-state';
        };
    };
    memory(id: string): import("./types.ts").Memory | undefined;
    life(id: string): import("./soul-types.ts").LifeEntry | undefined;
    timeline(limit?: number): import("./soul-types.ts").LifeEntry[];
    recall(query: string, limit?: number): {
        memories: import("./types.ts").RecallHit[];
        life: import("./soul-types.ts").LifeEntry[];
    };
    context(query: string, options?: SoulContextOptions): import("./types.ts").ContextPacket;
    sleep(): import("./soul-types.ts").Development;
    reflect(reflector: SoulReflector, signal?: AbortSignal, maxCallsPerDay?: number): Promise<{
        entries: import("./soul-types.ts").LifeEntry[];
        growth: import("./soul-types.ts").LifeEntry[];
        reviews: import("./soul-types.ts").LifeEntry[];
        intentions: import("./soul-types.ts").LifeEntry[];
    } | {
        skipped: boolean;
    }>;
    privacyForget(target: PrivacyTarget): {
        memoryIds: string[];
        lifeIds: string[];
        scope: string;
    };
    export(): import("./soul-archive.ts").SoulArchive;
    static restore(archive: unknown, options: SoulOptions): SoulCore;
    close(): void;
}
