import { access, readFile, writeFile, mkdir, rename, copyFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Plugin } from 'vite';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const maxBytes = 128 * 1024 * 1024;
function validate(raw: string) { const data = JSON.parse(raw); if (data.version !== 1 || !Array.isArray(data.subjects) || !Array.isArray(data.resources) || !data.prefs)
    throw Error('Invalid Margin backup'); return data; }
export function createBackupStore(root: string) { const directory = join(root, 'Margin'); const latest = join(directory, 'library.json'); const previous = join(directory, 'library.previous.json'); let queue: Promise<unknown> = Promise.resolve(); async function load(path = latest) { try {
    return await readFile(path, 'utf8');
}
catch (e: any) {
    if (e.code === 'ENOENT')
        return null;
    throw e;
} } async function status() { await access(root); const raw = await load(); let previousExists = false; try {
    await access(previous);
    previousExists = true;
}
catch { } const info = raw ? validate(raw) : null; return { available: true, folder: 'iCloud Drive / Margin', revision: raw ? hash(raw) : 'none', savedAt: raw ? (await stat(latest)).mtime.toISOString() : null, hasBackup: !!raw, hasPrevious: previousExists, newestDocument: info ? Math.max(0, ...info.resources.map((r: any) => Number(r.updated) || 0)) : 0 }; } return { status, async restore(old = false) { await access(root); const raw = await load(old ? previous : latest); if (!raw)
        throw Error('No backup found'); validate(raw); return raw; }, write(raw: string, expected: string) { const run = queue.catch(() => { }).then(async () => { validate(raw); if (Buffer.byteLength(raw) > maxBytes)
        throw Error('Backup exceeds 128 MB'); await access(root); const current = await load(); const revision = current ? hash(current) : 'none'; if (hash(raw) === revision)
        return status(); if (expected !== revision) {
        const error: any = new Error('The iCloud backup changed. Restore or review it before overwriting.');
        error.status = 409;
        throw error;
    } await mkdir(directory, { recursive: true }); const temp = join(directory, '.pending-' + randomBytes(8).toString('hex') + '.json'); await writeFile(temp, raw, { mode: 0o600 }); if (current)
        await copyFile(latest, previous); await rename(temp, latest); return status(); }); queue = run; return run; } }; }
export function iCloudBackupPlugin(): Plugin { const token = randomBytes(32).toString('hex'); const store = createBackupStore(join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs')); return { name: 'margin-local-icloud-backup', apply: 'serve', transformIndexHtml() { return [{ tag: 'meta', attrs: { name: 'margin-local-backup-token', content: token }, injectTo: 'head' }]; }, configureServer(server) { server.middlewares.use('/__margin/icloud', async (req, res) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); const respond = (code: number, value: unknown) => { res.statusCode = code; res.end(JSON.stringify(value)); }; const host = req.headers.host || ''; const remote = req.socket.remoteAddress || ''; const supplied = String(req.headers['x-margin-backup-token'] || ''); const origin = req.headers.origin; if (!/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) || origin && origin !== 'http://' + host || !/^[a-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token)))
        return respond(403, { error: 'Local backup access denied' }); try {
        const route = (req.url || '').split('?')[0];
        if (req.method === 'GET' && route === '/status')
            return respond(200, await store.status());
        if (req.method === 'GET' && route === '/restore') {
            const old = new URL(req.url!, 'http://' + host).searchParams.get('version') === 'previous';
            res.end(await store.restore(old));
            return;
        }
        if (req.method === 'POST' && route === '/backup') {
            let size = 0;
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
                const buffer = Buffer.from(chunk);
                size += buffer.length;
                if (size > maxBytes)
                    return respond(413, { error: 'Backup exceeds 128 MB' });
                chunks.push(buffer);
            }
            return respond(200, await store.write(Buffer.concat(chunks).toString('utf8'), String(req.headers['if-match'] || 'none')));
        }
        return respond(405, { error: 'Unsupported backup request' });
    }
    catch (e: any) {
        const message = e instanceof SyntaxError ? 'The existing iCloud backup is not a valid Margin file. It was not overwritten.' : e.code === 'ENOENT' ? 'iCloud Drive is unavailable. Enable Sync this Mac in iCloud settings.' : e.code === 'ENOSPC' ? 'Storage is full. Your existing backup was kept.' : e.code === 'EPERM' || e.code === 'EACCES' ? 'macOS denied access to iCloud Drive. Your notes are still saved in this browser.' : e.message;
        respond(e.status || 503, { error: message });
    } }); } }; }
