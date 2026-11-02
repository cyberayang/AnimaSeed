import { SoulRepository } from './soul-repository.ts';
import type { Lifecycle } from './soul-types.ts';
export interface NamingInput {
    name: string;
    namedBy: string;
    sessionId: string;
    messageId: string;
    text: string;
}
export declare function namingPhrase(text: string): string | undefined;
export declare function birth(repo: SoulRepository, input: NamingInput, now: string): Lifecycle;
export declare function adopt(repo: SoulRepository, confirmed: boolean, now: string): Lifecycle;
