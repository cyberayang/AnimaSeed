export const KINDS = ['episode', 'fact', 'habit', 'autobiography', 'commitment', 'reflection', 'summary'] as const;
export type MemoryKind = typeof KINDS[number];
export type Status = 'active' | 'superseded' | 'forgotten' | 'expired';
export const TRAITS = ['warmth', 'directness', 'curiosity', 'restraint'] as const;
export type Trait = typeof TRAITS[number];
export interface Identity {
  id: string;
  name: string;
  createdAt: string;
  principles: string[];
  baseline: Record<Trait, number>;
}
export interface Citation { id: string; quote: string }
export interface Memory {
  id: string;
  kind: MemoryKind;
  status: Status;
  text: string;
  at: string;
  role: 'user' | 'assistant' | 'derived';
  sessionId: string | null;
  externalKey: string | null;
  key: string | null;
  citations: Citation[];
  importance: number;
  confidence: number;
  entities: string[];
  expiresAt: string | null;
  pinned: boolean;
}
export interface DerivedInput {
  kind: Exclude<MemoryKind, 'episode'>;
  text: string;
  citations: Citation[];
  key?: string;
  importance?: number;
  confidence?: number;
  entities?: string[];
  expiresAt?: string;
  pinned?: boolean;
}
export interface Observation {
  sessionId: string;
  messageId: string;
  role: 'user' | 'assistant';
  text: string;
  at?: string;
  importance?: number;
  pinned?: boolean;
  expiresAt?: string;
}
export interface Change {
  id: string;
  at: string;
  trait: Trait;
  delta: number;
  why: string;
  citations: Citation[];
}
export interface Appraisal {
  id: string;
  at: string;
  valence: number;
  arousal: number;
  trust: number;
  why: string;
  citations: Citation[];
}
export interface Projection {
  identity: Identity;
  personality: Record<Trait, number>;
  affect: { valence: number; arousal: number; trust: number; kind: 'simulated-state' };
  changes: Change[];
  appraisals: Appraisal[];
}
export interface ConsolidationProposal {
  memories?: DerivedInput[];
  changes?: Omit<Change, 'id' | 'at'>[];
  appraisals?: Omit<Appraisal, 'id' | 'at'>[];
}
export interface ConsolidationInput { identity: Identity; episodes: Memory[]; known: Memory[] }
export type Consolidator = (input: ConsolidationInput, signal: AbortSignal) => Promise<unknown>;
export interface RecallHit { memory: Memory; score: number; reasons: string[] }
export interface ContextPacket {
  text: string;
  identityId: string;
  memoryIds: string[];
  chars: number;
  truncated: boolean;
}
