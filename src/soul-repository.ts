import { Store } from './store.ts';
import { tokens, matchQuery } from './tokens.ts';
import type { LifeEntry, LifeKind, SourceRef, Lifecycle } from './soul-types.ts';

export class SoulRepository {
  readonly store: Store;
  constructor(store: Store) { this.store = store; }
  lifecycle(): Lifecycle { return this.store.meta<Lifecycle>('soul.lifecycle')!; }
  revision(): number { return this.store.meta<number>('soul.revision') ?? 0; }
  changed(): void { this.store.setMeta('soul.revision', this.revision() + 1); }
  enqueue(id: string): void { this.store.db.prepare('INSERT OR IGNORE INTO soul_queue(id,done) VALUES(?,0)').run(id); }
  get(id: string): LifeEntry | undefined {
    const row = this.store.db.prepare('SELECT data FROM soul_life WHERE id=?').get(id) as { data: string } | undefined;
    return row && JSON.parse(row.data);
  }
  all(): LifeEntry[] {
    return (this.store.db.prepare('SELECT data FROM soul_life ORDER BY at,rowid').all() as { data: string }[]).map(x => JSON.parse(x.data));
  }
  list(kind?: LifeKind, limit = 100): LifeEntry[] {
    const rows = kind ? this.store.db.prepare("SELECT data FROM soul_life WHERE status='active' AND kind=? ORDER BY at DESC,rowid DESC LIMIT ?").all(kind, limit)
      : this.store.db.prepare("SELECT data FROM soul_life WHERE status='active' ORDER BY at DESC,rowid DESC LIMIT ?").all(limit);
    return (rows as { data: string }[]).map(x => JSON.parse(x.data));
  }
  current(kind: LifeKind, limit = 12): LifeEntry[] {
    const rows = this.store.db.prepare(`SELECT data FROM soul_life a WHERE status='active' AND kind=?
      AND NOT EXISTS(SELECT 1 FROM soul_life b WHERE b.status='active' AND json_extract(b.data,'$.revisesId')=a.id)
      ORDER BY a.at DESC,a.rowid DESC LIMIT ?`).all(kind, limit);
    return (rows as { data: string }[]).map(x => JSON.parse(x.data));
  }
  historical(id: string): boolean {
    return !!this.store.db.prepare("SELECT id FROM soul_life WHERE status='active' AND json_extract(data,'$.revisesId')=? LIMIT 1").get(id);
  }
  source(ref: SourceRef): { text: string; at: string; role: string } {
    if (ref.type === 'memory') {
      const row = this.store.get(ref.id);
      if (!row || row.status === 'forgotten' || !row.text.includes(ref.quote)) throw new Error('人生证据不存在、已清除或引文不匹配');
      return { text: row.text, at: row.at, role: row.role };
    }
    const row = this.get(ref.id);
    if (!row || row.status !== 'active' || !row.text.includes(ref.quote)) throw new Error('人生证据不存在、已清除或引文不匹配');
    return { text: row.text, at: row.at, role: row.kind };
  }
  validateSources(refs: SourceRef[], now: string): void {
    for (const ref of refs) if (this.source(ref).at > now) throw new Error('不能引用未来的人生经历');
  }
  put(row: LifeEntry): LifeEntry {
    const existing = this.get(row.id);
    if (existing) return existing;
    this.validateSources(row.citations, row.at);
    this.store.db.prepare('INSERT INTO soul_life VALUES(?,?,?,?,?)').run(row.id, row.kind, row.at, row.status, JSON.stringify(row));
    for (const ref of row.citations) this.store.db.prepare('INSERT INTO soul_links VALUES(?,?,?)').run(row.id, ref.type, ref.id);
    if (row.status === 'active') this.store.db.prepare('INSERT INTO soul_search VALUES(?,?)').run(row.id, tokens(row.topic + ' ' + row.text).join(' '));
    this.changed();
    return row;
  }
  search(query: string, limit = 12): LifeEntry[] {
    const match = matchQuery(query);
    if (!match) return [];
    const rows = this.store.db.prepare(`SELECT id FROM soul_search WHERE soul_search MATCH ? ORDER BY bm25(soul_search) LIMIT ?`).all(match, limit) as { id: string }[];
    return rows.map(x => this.get(x.id)!).filter(x => x.status === 'active');
  }
}
