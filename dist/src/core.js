import { randomUUID } from 'node:crypto';
import { Store } from './store.js';
import { observe, derive, refresh, forget, invalidate, evidence, ancestors } from './memories.js';
import { project, change, appraise } from './state.js';
import { recall } from './retrieval.js';
import { context } from './context.js';
import { applyProposal, localConsolidation, consolidationInput } from './consolidation.js';
import { pack, unpack, validatePackage } from './portable.js';
import * as v from './validation.js';
export class MemoryCore {
    #store;
    #clock;
    #closed = false;
    constructor(options) {
        this.#clock = options.clock ?? (() => new Date());
        this.#store = new Store(options.dataDir);
        try {
            this.#store.transaction(() => {
                if (!this.#store.identity()) {
                    const identity = v.identity({ id: randomUUID(), name: options.name ?? '阿一', createdAt: this.now(),
                        principles: options.principles ?? ['真实记录，承认不确定', '尊重用户边界与纠正', '不虚构共同经历'],
                        baseline: { warmth: 0.5, directness: 0.5, curiosity: 0.5, restraint: 0.5 } });
                    this.#store.setIdentity(identity);
                    this.#store.audit('birth', [identity.id], this.now());
                }
            });
        }
        catch (error) {
            this.#store.close();
            throw error;
        }
    }
    now() { return v.date(this.#clock().toISOString()); }
    get dataDir() { return this.#store.directory; }
    #fresh() { this.#store.transaction(() => refresh(this.#store, this.now())); }
    #read(operation) {
        return this.#store.transaction(() => { refresh(this.#store, this.now()); return operation(); });
    }
    identity() { return this.#store.identity(); }
    observe(input) {
        return this.#store.transaction(() => { refresh(this.#store, this.now()); return observe(this.#store, input, this.now()); });
    }
    remember(input) {
        return this.#store.transaction(() => { refresh(this.#store, this.now()); return derive(this.#store, input, this.now()); });
    }
    get(id) { return this.#read(() => this.#store.get(id)); }
    records() { return this.#read(() => this.#store.all()); }
    recall(query, limit = 8) {
        v.number(limit, 1, 32, '召回数量');
        return this.#read(() => recall(this.#store, v.text(query, '检索内容', 16000), this.now(), Math.floor(limit)));
    }
    context(query, maxChars = 6000) {
        return this.#read(() => context(this.#store, query, this.now(), maxChars));
    }
    state() { return this.#read(() => project(this.#store, this.now())); }
    change(input) {
        return this.#store.transaction(() => { refresh(this.#store, this.now()); return change(this.#store, input, this.now()); });
    }
    appraise(input) {
        return this.#store.transaction(() => { refresh(this.#store, this.now()); return appraise(this.#store, input, this.now()); });
    }
    correct(id, replacement, citations) {
        return this.#store.transaction(() => {
            refresh(this.#store, this.now());
            const old = this.#store.get(id);
            if (!old || old.status !== 'active' || old.kind === 'episode')
                throw new Error('只能纠正有效的整理记忆；原始经历不能改写');
            evidence(this.#store, v.citations(citations), true);
            if (citations.some(x => old.citations.some(c => c.id === x.id)))
                throw new Error('纠正必须引用新的用户证据');
            // Conservatively retire the old source episode, so it cannot re-enter via working memory.
            const roots = ancestors(this.#store, id);
            invalidate(this.#store, roots, 'superseded', this.now());
            return derive(this.#store, { kind: old.kind, text: replacement, citations,
                key: old.key ?? undefined, importance: old.importance, confidence: 1, pinned: old.pinned }, this.now());
        });
    }
    forget(id) {
        const ids = this.#store.transaction(() => forget(this.#store, id, this.now()));
        this.#store.db.exec('VACUUM');
        return { forgottenIds: ids, scope: '本数据目录；宿主对话记录与既有备份需要单独删除' };
    }
    sleep() {
        return this.#store.transaction(() => {
            const expired = refresh(this.#store, this.now()), result = localConsolidation(this.#store, this.now());
            const faded = result.stale.length ? invalidate(this.#store, result.stale, 'expired', this.now()) : [];
            return { ...result, expired: [...expired, ...faded] };
        });
    }
    async consolidate(consolidator, signal = AbortSignal.timeout(45000)) {
        signal.throwIfAborted();
        const input = this.#read(() => consolidationInput(this.#store));
        const proposal = await consolidator(input, signal);
        signal.throwIfAborted();
        return this.#store.transaction(() => applyProposal(this.#store, proposal, this.now()));
    }
    export() { return this.#read(() => pack(this.#store, this.now())); }
    static restore(packet, options) {
        const parsed = validatePackage(packet), store = new Store(options.dataDir);
        try {
            unpack(store, parsed);
        }
        finally {
            store.close();
        }
        return new MemoryCore(options);
    }
    status() {
        return this.#read(() => {
            const rows = this.#store.db.prepare('SELECT kind,status,count(*) AS count FROM nodes GROUP BY kind,status').all();
            return { version: 1, identity: this.identity(), memories: rows, dataDir: this.dataDir };
        });
    }
    close() { if (!this.#closed) {
        this.#store.close();
        this.#closed = true;
    } }
}
