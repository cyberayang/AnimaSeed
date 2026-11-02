import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import * as v from './validation.js';
export function writeTransfer(packet, path, password) {
    if (existsSync(path))
        throw new Error('导出文件已存在，拒绝覆盖');
    let output = packet;
    if (password !== undefined) {
        v.text(password, '迁移密码', 1024);
        if (password.length < 12)
            throw new Error('迁移密码至少12字符');
        const salt = randomBytes(16), iv = randomBytes(12), key = scryptSync(password, salt, 32);
        try {
            const cipher = createCipheriv('aes-256-gcm', key, iv);
            const encrypted = Buffer.concat([cipher.update(JSON.stringify(packet), 'utf8'), cipher.final()]);
            output = { format: 'memory-core-encrypted', version: 1, salt: salt.toString('base64'), iv: iv.toString('base64'),
                tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') };
        }
        finally {
            key.fill(0);
        }
    }
    writeFileSync(path, JSON.stringify(output), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
}
export function readTransfer(path, password) {
    if (statSync(path).size > 128 * 1024 * 1024)
        throw new Error('迁移包超过128MB，请分批归档');
    const bytes = readFileSync(path);
    if (bytes.length > 128 * 1024 * 1024)
        throw new Error('迁移包超过128MB，请分批归档');
    const input = v.object(JSON.parse(bytes.toString('utf8')));
    if (input.format !== 'memory-core-encrypted')
        return input;
    if (input.version !== 1 || !password)
        throw new Error('需要迁移密码或加密格式不受支持');
    const decode = (key, max) => Buffer.from(v.text(input[key], key, max), 'base64');
    const salt = decode('salt', 32), iv = decode('iv', 24), tag = decode('tag', 32);
    if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16)
        throw new Error('加密参数不正确');
    const key = scryptSync(password, salt, 32);
    try {
        const cipher = createDecipheriv('aes-256-gcm', key, iv);
        cipher.setAuthTag(tag);
        const clear = Buffer.concat([cipher.update(decode('data', 180 * 1024 * 1024)), cipher.final()]);
        return JSON.parse(clear.toString('utf8'));
    }
    finally {
        key.fill(0);
    }
}
