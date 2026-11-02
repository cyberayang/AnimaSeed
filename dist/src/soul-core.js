import { Store } from './store.js';
import { randomUUID } from 'node:crypto';
import { SoulRepository } from './soul-repository.js';
import { createSoulSchema } from './soul-schema.js';
import { birth, adopt } from './soul-lifecycle.js';
import { observeLife, authorLife, requireLiving } from './soul-life.js';
import { growthSample, growthReview } from './soul-growth-evidence.js';
import { development, advance } from './soul-development.js';
import { privacyRedact } from './soul-privacy.js';
import { soulContext, SOUL_RULES, SOUL_IDLE_RULES } from './soul-context.js';
import { reflectionInput, applyReflection } from './soul-reflection.js';
import { recall } from './retrieval.js';
import { refresh } from './memories.js';
import * as v from './validation.js';
import { packSoul, validateSoulArchive } from './soul-archive.js';
import { restoreSoul } from './soul-restore.js';
import { affectState } from './soul-affect.js';
import { intend, intentions, hostPermission, hostExperience } from './soul-agency.js';
export class SoulCore {
    #store;
    #repo;
    #clock;
    #closed = false;
    constructor(options) {
        this.#clock = options.clock ?? (() => new Date());
        this.#store = new Store(options.dataDir, 3);
        this.#repo = new SoulRepository(this.#store);
        try {
            createSoulSchema(this.#store, this.now());
        }
        catch (error) {
            this.#store.close();
            throw error;
        }
    }
    now() { return v.date(this.#clock().toISOString()); }
    get dataDir() { return this.#store.directory; }
    #read(operation) {
        return this.#store.transaction(() => { refresh(this.#store, this.now()); return operation(); });
    }
    lifecycle() { return this.#read(() => this.#repo.lifecycle()); }
    revision() { return this.#read(() => this.#repo.revision()); }
    maintenance() {
        return this.#read(() => ({ pending: this.#store.db.prepare("SELECT count(*) AS n FROM soul_queue q JOIN nodes n ON q.id=n.id WHERE q.done=0 AND n.status!='forgotten'").get().n,
            usage: this.#store.meta('soul.reflection-usage') ?? { day: this.now().slice(0, 10), count: 0 } }));
    }
    name(input) { return this.#read(() => birth(this.#repo, input, this.now())); }
    adoptLegacy(confirmed) { return this.#read(() => adopt(this.#repo, confirmed, this.now())); }
    observe(input) { return this.#read(() => observeLife(this.#repo, input, this.now())); }
    reply(input) {
        return this.#read(() => {
            const source = this.#store.get(v.text(input.inReplyTo, '本轮用户来源ID', 100));
            if (!source || source.status !== 'active' || source.role !== 'user' || source.sessionId !== input.sessionId)
                throw new Error('公开回复需要同一会话中有效的真实用户来源');
            const row = observeLife(this.#repo, { sessionId: input.sessionId, messageId: input.messageId, text: input.text, role: 'assistant' }, this.now());
            if (row.status === 'forgotten')
                throw new Error('该公开回复已隐私清除，不能重新写入');
            return row;
        });
    }
    record(input) { return this.#read(() => authorLife(this.#repo, input, this.now())); }
    intend(input) { return this.#read(() => intend(this.#repo, input, this.now())); }
    intentions(limit = 8) { return this.#read(() => intentions(this.#repo, this.now(), limit)); }
    hostPermission(input) { return this.#read(() => hostPermission(this.#repo, input, this.now())); }
    hostExperience(input) { return this.#read(() => hostExperience(this.#repo, input, this.now())); }
    idle() { return { kind: 'idle-opportunity', rules: SOUL_RULES + '\n' + SOUL_IDLE_RULES, context: this.context(''), intentions: this.intentions(4) }; }
    proposeGrowth(input) { return this.#read(() => growthSample(this.#repo, input, this.now())); }
    reviewGrowth(input) { return this.#read(() => growthReview(this.#repo, input, this.now())); }
    state() {
        return this.#read(() => ({ lifecycle: this.#repo.lifecycle(), development: development(this.#repo, this.now()),
            interests: this.#repo.current('interest').filter(x => x.details.interestState !== 'resolved'),
            preferences: this.#repo.current('preference'), understandings: this.#repo.current('understanding'), affect: affectState(this.#repo, this.now()) }));
    }
    memory(id) { return this.#read(() => this.#store.get(v.text(id, '记忆ID', 100))); }
    life(id) { return this.#read(() => this.#repo.get(v.text(id, '人生ID', 100))); }
    timeline(limit = 80) {
        v.number(limit, 1, 500, '时间线数量');
        return this.#read(() => this.#repo.list(undefined, Math.floor(limit)).reverse());
    }
    recall(query, limit = 8) {
        v.text(query, '检索内容');
        v.number(limit, 1, 32);
        return this.#read(() => ({ memories: recall(this.#store, query, this.now(), Math.floor(limit)),
            life: this.#repo.search(query, Math.floor(limit)) }));
    }
    context(query, options = {}) {
        return this.#read(() => soulContext(this.#repo, query, this.now(), options));
    }
    sleep() { return this.#read(() => this.#repo.lifecycle().phase === 'living' ? advance(this.#repo, this.now()) : development(this.#repo, this.now())); }
    async reflect(reflector, signal = AbortSignal.timeout(45000), maxCallsPerDay = 12) {
        signal.throwIfAborted();
        v.number(maxCallsPerDay, 0, 48, '每日空闲整理次数上限');
        if (!Number.isInteger(maxCallsPerDay))
            throw new Error('每日空闲整理次数应为整数');
        const owner = randomUUID();
        const input = this.#read(() => {
            requireLiving(this.#repo);
            const lease = this.#store.meta('soul.reflection-lease');
            if (lease && lease.until > this.now())
                return undefined;
            const day = this.now().slice(0, 10), usage = this.#store.meta('soul.reflection-usage');
            const count = usage?.day === day ? usage.count : 0;
            if (count >= maxCallsPerDay)
                return undefined;
            const input = reflectionInput(this.#repo, this.now());
            if (!input.episodes.length && !input.reviewCandidates.length)
                return undefined;
            this.#store.setMeta('soul.reflection-lease', { owner, until: new Date(Date.parse(this.now()) + 45000).toISOString() });
            this.#store.setMeta('soul.reflection-usage', { day, count: count + 1 });
            return input;
        });
        if (!input)
            return { skipped: true };
        try {
            const value = await reflector(input, signal);
            signal.throwIfAborted();
            return this.#read(() => {
                if (this.#store.meta('soul.reflection-lease')?.owner !== owner)
                    throw new Error('整理租约已失效，不提交过时结果');
                const result = applyReflection(this.#repo, value, input, this.now());
                advance(this.#repo, this.now());
                return result;
            });
        }
        finally {
            this.#read(() => {
                if (this.#store.meta('soul.reflection-lease')?.owner === owner)
                    this.#store.setMeta('soul.reflection-lease', null);
            });
        }
    }
    privacyForget(target) {
        if (target.type !== 'life' && target.type !== 'memory')
            throw new Error('隐私清除需要明确来源类型');
        v.text(target.id, '清除目标ID', 100);
        const result = this.#read(() => privacyRedact(this.#repo, target, this.now()));
        this.#store.db.exec('VACUUM');
        return result;
    }
    export() { return this.#read(() => packSoul(this.#repo, this.now())); }
    static restore(archive, options) {
        const parsed = validateSoulArchive(archive), core = new SoulCore(options);
        try {
            core.#read(() => restoreSoul(core.#repo, parsed, core.now()));
            return core;
        }
        catch (error) {
            core.close();
            throw error;
        }
    }
    close() { if (!this.#closed) {
        this.#store.close();
        this.#closed = true;
    } }
}
