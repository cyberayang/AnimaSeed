import { SoulCore } from './soul-core.ts';
import type { SoulContextOptions } from './soul-context.ts';
import type { IntentionInput } from './agency-types.ts';
import type { LifeInput } from './soul-types.ts';
export interface WorkspaceMessage {
    sessionId: string;
    messageId: string;
    text: string;
}
export interface WorkspaceReply extends WorkspaceMessage {
    inReplyTo: string;
}
export declare class SoulWorkspace {
    readonly soul: SoulCore;
    readonly workspaceDir: string;
    constructor(workspaceDir: string);
    open(query?: string, options?: SoulContextOptions): {
        protocol: string;
        soulId: string;
        name: string | null;
        namingRequired: boolean;
        rules: string;
        context: import("./types.ts").ContextPacket;
    };
    receive(input: WorkspaceMessage, options?: SoulContextOptions): {
        protocol: string;
        soulId: string;
        name: string | null;
        namingRequired: boolean;
        rules: string;
        context: import("./types.ts").ContextPacket;
        status: string;
        sourceId: null;
    } | {
        protocol: string;
        soulId: string;
        name: string | null;
        namingRequired: boolean;
        rules: string;
        context: import("./types.ts").ContextPacket;
        status: string;
        sourceId: string;
    };
    reply(input: WorkspaceReply): import("./types.ts").Memory;
    record(input: LifeInput): import("./soul-types.ts").LifeEntry;
    intend(input: IntentionInput): {
        intention: import("./soul-types.ts").LifeEntry;
        handoff: string;
        permissionGranted: boolean;
    };
    intentions(): import("./agency-types.ts").IntentionView[];
    idle(): {
        kind: string;
        rules: string;
        context: import("./types.ts").ContextPacket;
        intentions: import("./agency-types.ts").IntentionView[];
    };
    recall(query: string): {
        memories: import("./types.ts").RecallHit[];
        life: import("./soul-types.ts").LifeEntry[];
    };
    read(type: string, id: string): import("./soul-types.ts").LifeEntry | import("./types.ts").Memory | {
        id: string;
        unavailable: boolean;
    };
    close(): void;
}
export declare function initializeWorkspace(workspaceDir: string, command: string[]): {
    protocol: string;
    soulId: string;
    name: string | null;
    namingRequired: boolean;
    rules: string;
    context: import("./types.ts").ContextPacket;
    workspaceDir: string;
    guide: string;
};
