import { Store } from './store.ts';
import type { ConsolidationInput, ConsolidationProposal, Memory } from './types.ts';
export declare function consolidationInput(store: Store): ConsolidationInput;
export declare function proposal(value: unknown): ConsolidationProposal;
export declare function applyProposal(store: Store, input: unknown, now: string): {
    memories: Memory[];
    changes: import("./types.ts").Change[];
    appraisals: import("./types.ts").Appraisal[];
};
export declare function localConsolidation(store: Store, now: string): {
    memories: string[];
    changes: string[];
    appraisals: string[];
    stale: string[];
};
