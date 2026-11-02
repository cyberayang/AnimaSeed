import { randomUUID, createHash } from 'node:crypto';
import { Store } from './store.js';
export function createSoulSchema(store, now) {
    store.transaction(() => {
        store.db.exec(`
      CREATE TABLE IF NOT EXISTS soul_life(id TEXT PRIMARY KEY, kind TEXT NOT NULL,
        at TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS soul_life_kind ON soul_life(kind,status,at);
      CREATE INDEX IF NOT EXISTS soul_life_revision ON soul_life(json_extract(data,'$.revisesId')) WHERE status='active';
      CREATE INDEX IF NOT EXISTS soul_host_request ON soul_life(kind,json_extract(data,'$.details.requestId'),at) WHERE status='active';
      CREATE TABLE IF NOT EXISTS soul_links(child TEXT NOT NULL REFERENCES soul_life(id),
        source_type TEXT NOT NULL, source_id TEXT NOT NULL, PRIMARY KEY(child,source_type,source_id));
      CREATE INDEX IF NOT EXISTS soul_links_source ON soul_links(source_type,source_id);
      CREATE VIRTUAL TABLE IF NOT EXISTS soul_search USING fts5(id UNINDEXED,tokens,tokenize='unicode61');
      CREATE TABLE IF NOT EXISTS soul_queue(id TEXT PRIMARY KEY REFERENCES nodes(id), done INTEGER NOT NULL DEFAULT 0);
    `);
        if (!store.meta('soul.lifecycle')) {
            const old = store.identity(), id = old?.id ?? randomUUID();
            const seed = createHash('sha256').update(id).digest();
            const lifecycle = {
                id, phase: old ? 'legacy' : 'awaiting-name', origin: old ? 'adopted' : 'newborn',
                openedAt: now, bornAt: null, name: old?.name ?? null, namedBy: null,
                birthEventId: null, namingRequest: null,
                temperament: { inquiry: 0.45 + seed[0] / 2550, caution: 0.45 + seed[1] / 2550 },
            };
            store.setMeta('soul.lifecycle', lifecycle);
            store.setMeta('soul.revision', 0);
        }
        if (!store.meta('soul.host-epoch'))
            store.setMeta('soul.host-epoch', randomUUID());
        if (store.meta('soul.lifecycle').phase !== 'legacy')
            store.db.exec('PRAGMA user_version=3');
    });
}
