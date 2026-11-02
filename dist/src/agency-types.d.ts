import type { SourceRef, LifeEntry } from './soul-types.ts';
export type { IntentionInput } from './soul-types.ts';
export interface HostPermissionInput {
    requestId: string;
    hostId: string;
    eventId: string;
    decision: 'granted' | 'denied' | 'revoked' | 'unavailable' | 'cancelled';
    text: string;
    scope?: string;
    mode?: 'once' | 'ongoing';
    expiresAt?: string | null;
    approvalRef?: string;
    approval?: SourceRef;
}
export interface HostExperienceInput {
    requestId: string;
    permissionId: string;
    hostId: string;
    eventId: string;
    outcome: 'completed' | 'failed';
    text: string;
    occurredAt?: string;
    url?: string;
}
export interface IntentionView {
    intention: LifeEntry;
    permission: LifeEntry | null;
    experience: LifeEntry | null;
    authorization: 'needed' | 'granted' | 'expired' | 'consumed' | 'revalidation-required' | 'denied' | 'revoked' | 'unavailable' | 'cancelled';
}
