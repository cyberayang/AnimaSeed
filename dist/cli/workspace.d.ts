export declare const workspaceHelp = "\u5DE5\u4F5C\u533A\u95ED\u73AF\uFF08\u53EA\u7528\u5BBF\u4E3B\u6A21\u578B\uFF0C\u65E0\u72EC\u7ACB\u804A\u5929\u670D\u52A1\uFF09\uFF1A\n  workspace-init                                  \u5B89\u88C5\u9996\u6B21\u5F15\u5BFC\uFF0C\u4FDD\u7559\u5DF2\u6709AGENTS\u4E0E\u8EAB\u4EFD\n  workspace-open [--text \u672C\u8F6E\u4E3B\u9898]                 \u65B0\u5BF9\u8BDD/\u538B\u7F29\u540E\u6062\u590D\u540C\u4E00\u8EAB\u4EFD\u4E0E\u5F53\u524D\u5FEB\u7167\n  workspace-receive --file <JSON\u8DEF\u5F84\u6216->            \u5DF2\u63D0\u4EA4\u7528\u6237\u539F\u8BDD\uFF1B\u660E\u786E\u547D\u540D\u4E5F\u4ECE\u6B64\u5165\u53E3\u63D0\u4EA4\n  workspace-reply --file <JSON\u8DEF\u5F84\u6216->              \u5DF2\u516C\u5F00\u5B8C\u6574\u56DE\u590D\uFF0C\u9700\u5F15\u7528\u672C\u8F6E\u7528\u6237\u6765\u6E90ID\n  workspace-record --file <JSON\u8DEF\u5F84\u6216->             \u5BBF\u4E3B\u63D0\u4EA4\u6709\u6765\u6E90\u7684\u7406\u89E3/\u672A\u7ED3\u675F\u8BDD\u9898\n  workspace-intend --file <JSON\u8DEF\u5F84\u6216->             \u63D0\u51FA\u610F\u613F\u4E0E\u6240\u9700\u80FD\u529B\uFF0C\u4E0D\u81EA\u884C\u6388\u6743\u6216\u6267\u884C\n  workspace-intentions                            \u67E5\u770B\u610F\u613F\u53CA\u5BBF\u4E3B\u56DE\u6267\n  workspace-idle                                  \u5BBF\u4E3B\u7A7A\u95F2\u5524\u9192\u8D44\u6599\uFF0C\u4E0D\u81EA\u52A8\u8C03\u7528\u6A21\u578B\n  workspace-recall --text <\u4E3B\u9898>                   \u67E5\u627E\u65E9\u671F\u7ECF\u5386\n  workspace-read --type memory|life --id <ID>       \u6309ID\u5C55\u5F00\n  workspace-scope --scope companion-only|exclude|all [--dir <\u7EDD\u5BF9\u8DEF\u5F84>] [--exclude <\u7EDD\u5BF9\u8DEF\u5F84>]\n                                                  \u8D77\u540D\u540E\u8BBE\u5B9A\u8BB0\u5F55\u8303\u56F4\uFF1A\u53EA\u8BB0\u966A\u4F34\u76EE\u5F55\u8FD8\u662F\u5168\u90E8\uFF1B\n                                                  --dir \u8FFD\u52A0\u966A\u4F34\u76EE\u5F55\uFF0C--exclude \u8FFD\u52A0\u6392\u9664\u76EE\u5F55\n\u5DE5\u4F5C\u533A\u9009\u9879\uFF1A--workspace <\u76EE\u5F55> \u9ED8\u8BA4\u5F53\u524D\u76EE\u5F55\uFF1Bopen/receive\u9ED8\u8BA4\u4EC5\u63D0\u4F9B\u7B80\u77ED\u951A\u70B9\uFF0C\u65E0\u5168\u6587\u68C0\u7D22\u3002\n\u663E\u5F0F --mode recall \u53EF\u7EC4\u88C5\u56DE\u5FC6\u5FEB\u7167\uFF1B--max-chars 2000\u81F332000\u3002\n\u6B63\u6587JSON\u7684sessionId/messageId\u6765\u81EA\u771F\u5B9E\u5BBF\u4E3B\u6D88\u606F\u5E76\u5728\u91CD\u8BD5\u65F6\u4FDD\u6301\u7A33\u5B9A\u3002";
export declare function workspaceCommand(command: string, flags: Record<string, string>): import("../src/agency-types.ts").IntentionView[] | import("../src/soul-types.ts").LifeEntry | import("../src/types.ts").Memory | {
    kind: string;
    rules: string;
    context: import("../src/types.ts").ContextPacket;
    intentions: import("../src/agency-types.ts").IntentionView[];
} | {
    memories: import("../src/types.ts").RecallHit[];
    life: import("../src/soul-types.ts").LifeEntry[];
} | {
    protocol: string;
    soulId: string;
    name: string | null;
    namingRequired: boolean;
    rules: string;
    context: import("../src/types.ts").ContextPacket;
} | {
    intention: import("../src/soul-types.ts").LifeEntry;
    handoff: string;
    permissionGranted: boolean;
} | {
    id: string;
    unavailable: boolean;
} | {
    path: string;
    settings: import("../src/scope.ts").ScopeSettings;
};
