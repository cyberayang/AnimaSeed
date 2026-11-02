import type { Citation, Memory } from './types.ts';
export declare const LIFE_KINDS: readonly ['birth', 'adoption', 'interaction', 'understanding', 'choice', 'feedback', 'reflection', 'interest', 'preference', 'affect', 'autobiography', 'continuity', 'intention', 'permission', 'experience', 'growth-sample', 'growth-review', 'stage'];
export type LifeKind = typeof LIFE_KINDS[number];
export type AuthoredKind = 'understanding' | 'choice' | 'feedback' | 'reflection' | 'interest' | 'preference' | 'affect' | 'autobiography' | 'continuity';
export declare const DOMAINS: readonly ['expression', 'memory', 'understanding', 'self', 'relationship', 'regulation'];
export type Domain = typeof DOMAINS[number];
export declare const STAGES: readonly ['newborn', 'exploring', 'childhood', 'adolescent', 'young-adult'];
export type Stage = typeof STAGES[number];
export interface SourceRef extends Citation {
    type: 'memory' | 'life';
}
export interface PrivacyTarget {
    type: 'memory' | 'life';
    id: string;
    match?: string;
}
export interface LifeEntry {
    id: string;
    kind: LifeKind;
    at: string;
    status: 'active' | 'redacted';
    text: string;
    topic: string;
    citations: SourceRef[];
    revisesId: string | null;
    confidence: number;
    details: Record<string, string | number | boolean | null>;
}
export interface Lifecycle {
    id: string;
    phase: 'awaiting-name' | 'living' | 'legacy';
    origin: 'newborn' | 'adopted';
    openedAt: string;
    bornAt: string | null;
    name: string | null;
    namedBy: string | null;
    birthEventId: string | null;
    namingRequest: string | null;
    temperament: {
        inquiry: number;
        caution: number;
    };
}
export interface LifeInput {
    kind: AuthoredKind;
    text: string;
    topic: string;
    citations: SourceRef[];
    revisesId?: string;
    confidence?: number;
    outcome?: 'supported' | 'uncertain' | 'contradicted';
    interestState?: 'open' | 'resolved';
    affect?: {
        valence: number;
        arousal: number;
        trust: number;
    };
}
export interface IntentionInput {
    text: string;
    capability: string;
    purpose: string;
    scope: string;
    duration: string;
    citations: SourceRef[];
    revisesId?: string;
    state?: 'open' | 'withdrawn';
}
export interface GrowthSampleInput {
    domain: Domain;
    baselineId: string;
    learningId: string;
    applicationId: string;
    feedbackId: string;
    context: string;
}
export interface GrowthReviewInput {
    sampleId: string;
    verdict: 'supported' | 'uncertain' | 'contradicted';
    rationale: string;
}
export interface Development {
    stage: Stage | 'unassessed';
    label: string;
    bornDays: number | null;
    activeDays: number;
    dimensions: Record<Domain, {
        score: number;
        supported: number;
        candidate: number;
        uncertain: number;
    }>;
    next: Stage | null;
    ready: boolean;
    reasons: string[];
    evidenceIds: string[];
    basis: 'observed' | 'unassessed';
}
export interface SoulSnapshot {
    lifecycle: Lifecycle;
    development: Development;
    interests: LifeEntry[];
    preferences: LifeEntry[];
    understandings: LifeEntry[];
    affect: {
        valence: number;
        arousal: number;
        trust: number;
        kind: 'simulated-state';
    };
}
export interface SoulReflectionInput {
    lifecycle: Lifecycle;
    development: Development;
    episodes: Memory[];
    current: LifeEntry[];
    reviewCandidates: LifeEntry[];
    reviewEvidence: {
        sampleId: string;
        entries: LifeEntry[];
        episodes: Memory[];
    }[];
}
export interface SoulProposal {
    entries?: LifeInput[];
    intentions?: IntentionInput[];
    growth?: GrowthSampleInput[];
    reviews?: GrowthReviewInput[];
}
export type SoulReflector = (input: SoulReflectionInput, signal: AbortSignal) => Promise<unknown>;
