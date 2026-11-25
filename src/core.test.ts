import { describe, it, expect } from 'vitest';
import { retrieve, visibleCommands, importLibrary, exportLibrary, type Resource, type Command, initial } from './core';
import { validateCommands } from './core-validation';
import { askGeminiDirect, testGeminiConnection } from './gemini';
const command: Command = { id: 'a', type: 'write_equation', text: 'V=IR', x: 20, y: 20, x2: 0, y2: 0 };
describe('teaching safety', () => { it('rejects unknown commands and invalid coordinates', () => { expect(() => validateCommands([{ ...command, type: 'execute_script' }])).toThrow(); expect(() => validateCommands([{ ...command, x: NaN }])).toThrow(); expect(() => validateCommands([{ ...command, y: 1100 }])).toThrow(); }); it('only executes reached steps and supports erase', () => { expect(visibleCommands([command], 0)).toEqual([]); expect(visibleCommands([command], 1)).toEqual([command]); expect(visibleCommands([command, { ...command, id: 'b', type: 'erase_element', text: 'a' }], 2)).toEqual([]); }); });
describe('subject isolation', () => { it('never retrieves matching content from another subject', () => { const make = (id: string, subject: string, text: string): Resource => ({ id, subject, folder: '', name: id, kind: 'note', updated: 0, chat: [], pages: [{ text, strokes: [], commands: [] }] }); expect(retrieve([make('mine', 'a', 'resistance'), make('private', 'b', 'resistance resistance')], 'a', 'resistance', 'mine', 0).map(c => c.file)).toEqual(['mine']); }); });
describe('backup validation', () => { it('rejects unknown formats', () => expect(() => importLibrary('{}')).toThrow()); it('round trips document bytes', async () => { const r: Resource = { id: 'doc', subject: 'start', folder: '', name: 'sample.pdf', kind: 'pdf', updated: 0, chat: [], pages: [{ text: 'hello', strokes: [], commands: [command] }], data: new Uint8Array([0, 1, 255]).buffer }; const restored = importLibrary(await exportLibrary({ ...initial, resources: [r] })); expect(new Uint8Array(restored.resources[0].data!)).toEqual(new Uint8Array([0, 1, 255])); }); });

describe('BYOK Gemini client', () => {
  it('sends key in x-goog-api-key header and never in URL', async () => {
    let seenUrl = '';
    let seenHeader = '';
    const mockFetch: any = async (url: string, init: any) => {
      seenUrl = url;
      seenHeader = init.headers['x-goog-api-key'];
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }), { status: 200 });
    };
    const res = await testGeminiConnection('secret-test-key', 'gemini-2.5-flash', mockFetch);
    expect(res.ok).toBe(true);
    expect(seenUrl).not.toContain('secret-test-key');
    expect(seenHeader).toBe('secret-test-key');
  });

  it('handles 429 rate limits and invalid keys cleanly', async () => {
    const rateLimited: any = async () => new Response('quota', { status: 429 });
    const r429 = await testGeminiConnection('k', 'gemini-2.5-flash', rateLimited);
    expect(r429.ok).toBe(false);
    expect(r429.message).toMatch(/rate limit/i);

    const invalid: any = async () => new Response('API_KEY_INVALID', { status: 400 });
    await expect(
      askGeminiDirect(
        {
          apiKey: 'bad',
          message: 'hi',
          context: [],
          history: [],
          mode: 'Explain',
          languages: initial.prefs,
          selection: '',
          currentPage: 1,
          currentFile: 'test.pdf',
        },
        invalid
      )
    ).rejects.toThrow(/Invalid Gemini API key/i);
  });
});
