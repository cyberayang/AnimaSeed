import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tokens } from './tokens.js';
export class Store {
    db;
    directory;
    constructor(directory, supportedVersion = 1) {
        this.directory = resolve(directory);
        mkdirSync(this.directory, { recursive: true });
        this.db = new DatabaseSync(join(this.directory, 'memory.sqlite'));
        this.db.exec('PRAGMA busy_timeout=2000; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; PRAGMA journal_mode=DELETE;');
        const version = this.db.prepare('PRAGMA user_version').get();
        if (version.user_version > supportedVersion) {
            this.db.close();
            throw new Error('数据库版本较新，不能降级打开');
        }
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS nodes(id TEXT PRIMARY KEY, kind TEXT NOT NULL,
        status TEXT NOT NULL, at TEXT NOT NULL, external_key TEXT UNIQUE, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS nodes_status ON nodes(status, kind, at);
      CREATE INDEX IF NOT EXISTS nodes_expiry ON nodes(json_extract(data,'$.expiresAt'))
        WHERE status='active' AND json_extract(data,'$.expiresAt') IS NOT NULL;
      CREATE INDEX IF NOT EXISTS nodes_pinned ON nodes(at DESC)
        WHERE status='active' AND json_extract(data,'$.pinned')=1;
      CREATE TABLE IF NOT EXISTS sources(child TEXT NOT NULL REFERENCES nodes(id),
        parent TEXT NOT NULL REFERENCES nodes(id), PRIMARY KEY(child, parent));
      CREATE INDEX IF NOT EXISTS sources_parent ON sources(parent);
      CREATE TABLE IF NOT EXISTS changes(id TEXT PRIMARY KEY, at TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS appraisals(id TEXT PRIMARY KEY, at TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, at TEXT NOT NULL, kind TEXT NOT NULL, targets TEXT NOT NULL);
      CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(id UNINDEXED, tokens, tokenize='unicode61');
    `);
        if (version.user_version === 0)
            this.db.exec('PRAGMA user_version=1');
    }
    transaction(operation) {
        this.db.exec('BEGIN IMMEDIATE');
        try {
            const result = operation();
            this.db.exec('COMMIT');
            return result;
        }
        catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }
    }
    identity() {
        const row = this.db.prepare("SELECT data FROM meta WHERE key='identity'").get();
        return row && JSON.parse(row.data);
    }
    meta(key) {
        const row = this.db.prepare('SELECT data FROM meta WHERE key=?').get(key);
        return row && JSON.parse(row.data);
    }
    setMeta(key, value) {
        this.db.prepare('INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').run(key, JSON.stringify(value));
    }
    setIdentity(value) {
        this.db.prepare("INSERT INTO meta VALUES ('identity', ?) ON CONFLICT(key) DO UPDATE SET data=excluded.data").run(JSON.stringify(value));
    }
    get(id) {
        const row = this.db.prepare('SELECT data FROM nodes WHERE id=?').get(id);
        return row && JSON.parse(row.data);
    }
    byExternalKey(key) {
        const row = this.db.prepare('SELECT data FROM nodes WHERE external_key=?').get(key);
        return row && JSON.parse(row.data);
    }
    all(status) {
        const rows = status
            ? this.db.prepare('SELECT data FROM nodes WHERE status=? ORDER BY at,id').all(status)
            : this.db.prepare('SELECT data FROM nodes ORDER BY at,id').all();
        return rows.map(x => JSON.parse(x.data));
    }
    recent(limit = 40) {
        return this.db.prepare("SELECT data FROM nodes WHERE status='active' ORDER BY at DESC,rowid DESC LIMIT ?")
            .all(limit).map(x => JSON.parse(x.data));
    }
    category(kind, limit) {
        return this.db.prepare("SELECT data FROM nodes WHERE status='active' AND kind=? ORDER BY at DESC,rowid DESC LIMIT ?")
            .all(kind, limit).map(x => JSON.parse(x.data));
    }
    pinned(limit) {
        return this.db.prepare("SELECT data FROM nodes WHERE status='active' AND json_extract(data,'$.pinned')=1 ORDER BY at DESC LIMIT ?")
            .all(limit).map(x => JSON.parse(x.data));
    }
    put(record) {
        this.db.prepare(`INSERT INTO nodes VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
      kind=excluded.kind,status=excluded.status,at=excluded.at,external_key=excluded.external_key,data=excluded.data`)
            .run(record.id, record.kind, record.status, record.at, record.externalKey, JSON.stringify(record));
        this.db.prepare('DELETE FROM search WHERE id=?').run(record.id);
        if (record.status === 'active')
            this.db.prepare('INSERT INTO search(id,tokens) VALUES(?,?)')
                .run(record.id, tokens(record.text + ' ' + record.entities.join(' ')).join(' '));
        this.db.prepare('DELETE FROM sources WHERE child=?').run(record.id);
        for (const citation of record.citations)
            this.db.prepare('INSERT INTO sources VALUES(?,?)').run(record.id, citation.id);
    }
    dependents(ids) {
        if (!ids.length)
            return [];
        const result = new Set(ids), queue = [...ids];
        for (let i = 0; i < queue.length; i++) {
            const rows = this.db.prepare('SELECT child FROM sources WHERE parent=?').all(queue[i]);
            for (const row of rows)
                if (!result.has(row.child)) {
                    result.add(row.child);
                    queue.push(row.child);
                }
        }
        return [...result];
    }
    values(table) {
        return this.db.prepare(`SELECT data FROM ${table} ORDER BY at,id`).all().map(x => JSON.parse(x.data));
    }
    addState(table, value) {
        this.db.prepare(`INSERT INTO ${table} VALUES(?,?,?)`).run(value.id, value.at, JSON.stringify(value));
    }
    audit(kind, targets, at) {
        this.db.prepare('INSERT INTO audit VALUES(?,?,?,?)').run(randomUUID(), at, kind, JSON.stringify(targets));
    }
    close() { this.db.close(); }
}
