import { it, expect } from 'vitest';
import { mkdtemp, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBackupStore } from './icloud';
const backup = (name: string) => JSON.stringify({ version: 1, subjects: [{ id: 's', name, folders: [] }], resources: [], prefs: { conversation: 'English', explanation: 'English', writing: 'English' } });
it('writes a restorable backup and keeps the previous version', async () => { const root = await mkdtemp(join(tmpdir(), 'margin-icloud-test-')); try {
    const store = createBackupStore(root);
    expect((await store.status()).revision).toBe('none');
    const first = await store.write(backup('first'), 'none');
    const second = await store.write(backup('second'), first.revision);
    expect(second.hasPrevious).toBe(true);
    expect(await store.restore()).toBe(backup('second'));
    expect(await store.restore(true)).toBe(backup('first'));
    expect(await readFile(join(root, 'Margin', 'library.json'), 'utf8')).not.toContain('apiKey');
}
finally {
    await rm(root, { recursive: true, force: true });
} });
it('rejects stale writers and malformed data without replacing a good backup', async () => { const root = await mkdtemp(join(tmpdir(), 'margin-icloud-test-')); try {
    const store = createBackupStore(root);
    await store.write(backup('good'), 'none');
    await expect(store.write(backup('stale'), 'none')).rejects.toThrow('changed');
    await expect(store.write('{}', 'none')).rejects.toThrow('Invalid');
    expect(await store.restore()).toBe(backup('good'));
}
finally {
    await rm(root, { recursive: true, force: true });
} });
it('does not create an iCloud root when the account folder is unavailable', async () => { const root = await mkdtemp(join(tmpdir(), 'margin-icloud-test-')); try {
    const store = createBackupStore(join(root, 'not-enabled'));
    await expect(store.write(backup('x'), 'none')).rejects.toThrow();
    await expect(store.status()).rejects.toThrow();
}
finally {
    await rm(root, { recursive: true, force: true });
} });
it('rejects remote origins and missing local tokens before touching storage', async () => { const { iCloudBackupPlugin } = await import('./icloud'); const plugin = iCloudBackupPlugin(); let middleware: any; (plugin.configureServer as any)({ middlewares: { use: (_: string, handler: any) => middleware = handler } }); for (const request of [{ headers: { host: '127.0.0.1:5173' }, socket: { remoteAddress: '127.0.0.1' } }, { headers: { host: 'attacker.example', origin: 'http://attacker.example', 'x-margin-backup-token': 'x'.repeat(64) }, socket: { remoteAddress: '127.0.0.1' } }]) {
    let status = 0, body = '';
    const response: any = { setHeader: () => { }, set statusCode(value: number) { status = value; }, end: (value: string) => body = value };
    await middleware({ ...request, method: 'POST', url: '/backup' }, response);
    expect(status).toBe(403);
    expect(JSON.parse(body).error).toMatch(/denied/);
} });
