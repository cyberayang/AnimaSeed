export type RecordScope = 'companion-only' | 'exclude' | 'all';
export interface ScopeSettings {
    version: 1;
    scope: RecordScope;
    companionDirs: string[];
    excludeDirs: string[];
}
export declare const SCOPE_FILE = "scope.json";
export declare const DEFAULT_SCOPE: ScopeSettings;
export declare function parseScope(input: unknown): ScopeSettings;
export declare function readScope(dataDir: string): ScopeSettings | undefined;
export declare function writeScope(dataDir: string, input: unknown): {
    path: string;
    settings: ScopeSettings;
};
