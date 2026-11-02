import { Store } from './store.js';
import { tokens, matchQuery } from './tokens.js';
export class SoulRepository {
    store;
    constructor(store) { this.store = store; }
    lifecycle() { return this.store.meta('soul.lifecycle'); }
    revision() { return this.store.meta('soul.revision') ?? 0; }
    changed() { this.store.setMeta('soul.revision', this.revision() + 1); }
    enqueue(id) { this.store.db.prepare('INSERT OR IGNORE INTO soul_queue(id,done) VALUES(?,0)').run(id); }
    get(id) {
        const row = this.store.db.prepare('SELECT data FROM soul_life WHERE id=?').get(id);
        return row && JSON.parse(row.data);
    }
    all() {
        return this.store.db.prepare('SELECT data FROM soul_life ORDER BY at,rowid').all().map(x => JSON.parse(x.data));
    }
    list(kind, limit = 100) {
        const rows = kind ? this.store.db.prepare("SELECT data FROM soul_life WHERE status='active' AND kind=? ORDER BY at DESC,rowid DESC LIMIT ?").all(kind, limit)
            : this.store.db.prepare("SELECT data FROM soul_life WHERE status='active' ORDER BY at DESC,rowid DESC LIMIT ?").all(limit);
        return rows.map(x => JSON.parse(x.data));
    }
    current(kind, limit = 12) {
        const rows = this.store.db.prepare(`SELECT data FROM soul_life a WHERE status='active' AND kind=?
      AND NOT EXISTS(SELECT 1 FROM soul_life b WHERE b.status='active' AND json_extract(b.data,'$.revisesId')=a.id)
      ORDER BY a.at DESC,a.rowid DESC LIMIT ?`).all(kind, limit);
        return rows.map(x => JSON.parse(x.data));
    }
    historical(id) {
        return !!this.store.db.prepare("SELECT id FROM soul_life WHERE status='active' AND json_extract(data,'$.revisesId')=? LIMIT 1").get(id);
    }
    source(ref) {
        if (ref.type === 'memory') {
            const row = this.store.get(ref.id);
            if (!row || row.status === 'forgotten' || !row.text.includes(ref.quote))
                throw new Error('人生证据不存在、已清除或引文不匹配');
            return { text: row.text, at: row.at, role: row.role };
        }
        const row = this.get(ref.id);
        if (!row || row.status !== 'active' || !row.text.includes(ref.quote))
            throw new Error('人生证据不存在、已清除或引文不匹配');
        return { text: row.text, at: row.at, role: row.kind };
    }
    validateSources(refs, now) {
        for (const ref of refs)
            if (this.source(ref).at > now)
                throw new Error('不能引用未来的人生经历');
    }
    put(row) {
        const existing = this.get(row.id);
        if (existing)
            return existing;
        this.validateSources(row.citations, row.at);
        this.store.db.prepare('INSERT INTO soul_life VALUES(?,?,?,?,?)').run(row.id, row.kind, row.at, row.status, JSON.stringify(row));
        for (const ref of row.citations)
            this.store.db.prepare('INSERT INTO soul_links VALUES(?,?,?)').run(row.id, ref.type, ref.id);
        if (row.status === 'active')
            this.store.db.prepare('INSERT INTO soul_search VALUES(?,?)').run(row.id, tokens(row.topic + ' ' + row.text).join(' '));
        this.changed();
        return row;
    }
    search(query, limit = 12) {
        const match = matchQuery(query);
        if (!match)
            return [];
        const rows = this.store.db.prepare(`SELECT id FROM soul_search WHERE soul_search MATCH ? ORDER BY bm25(soul_search) LIMIT ?`).all(match, limit);
        return rows.map(x => this.get(x.id)).filter(x => x.status === 'active');
    }
}
