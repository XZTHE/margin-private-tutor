import { openDB } from 'idb';
export type Stroke = {
    id: string;
    points: number[][];
    color: string;
    width: number;
};
export type Command = {
    type: 'write_text' | 'write_equation' | 'draw_line' | 'draw_arrow' | 'draw_shape' | 'highlight_region' | 'circle_region' | 'erase_element' | 'explain_step';
    id: string;
    text: string;
    x: number;
    y: number;
    x2: number;
    y2: number;
};
export type Page = {
    ratio?: number;
    text: string;
    image?: string;
    strokes: Stroke[];
    commands: Command[];
};
export type Resource = {
    id: string;
    subject: string;
    folder: string;
    name: string;
    kind: string;
    pages: Page[];
    data?: ArrayBuffer;
    updated: number;
    lesson?: {
        commands: Command[];
        index: number;
        page: number;
    };
    chat: {
        role: string;
        text: string;
    }[];
};
export type Subject = {
    id: string;
    name: string;
    folders: string[];
};
export type Prefs = {
    ui?: string;
    endpoint: string;
    geminiModel?: string;
    conversation: string;
    explanation: string;
    writing: string;
};
export type Library = {
    subjects: Subject[];
    resources: Resource[];
    prefs: Prefs;
};
export const initial: Library = { subjects: [{ id: 'start', name: 'My studies', folders: [] }], resources: [], prefs: { endpoint: '', conversation: 'English', explanation: 'English', writing: 'English' } };
let database: ReturnType<typeof openDB> | undefined;
const getDB = () => database ??= openDB('margin-tutor', 1, { upgrade(db) { db.createObjectStore('library'); } });
export async function save(data: Library) { await (await getDB()).put('library', data, 'main'); }
export async function read(): Promise<Library> { return (await (await getDB()).get('library', 'main')) || initial; }
export function retrieve(resources: Resource[], subject: string, query: string, current: string, page: number) { const words = query.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []; return resources.filter(r => r.subject === subject).flatMap(r => r.pages.map((p, i) => ({ resource: r.id, file: r.name, page: i + 1, text: p.text.slice(0, 3000), score: words.reduce((s, w) => s + (p.text.toLowerCase().includes(w) ? 1 : 0), 0) + (r.id === current && i === page ? 5 : 0) }))).sort((a, b) => b.score - a.score).slice(0, 6); }
export { validateCommands } from './core-validation';
import { validateCommands } from './core-validation';
export function visibleCommands(commands: Command[], index: number) { return commands.slice(0, index).filter((c, _, all) => c.type !== 'erase_element' && !all.some(e => e.type === 'erase_element' && e.text === c.id)); }
export async function exportLibrary(data: Library) { const resources = await Promise.all(data.resources.map(async (r) => ({ ...r, data: r.data ? btoa(Array.from(new Uint8Array(r.data), b => String.fromCharCode(b)).join('')) : undefined }))); return JSON.stringify({ version: 1, ...data, resources }); }
export function importLibrary(raw: string): Library { const d = JSON.parse(raw); if (d.version !== 1 || !Array.isArray(d.subjects) || !Array.isArray(d.resources) || !d.prefs)
    throw Error('Not a Margin backup'); for (const s of d.subjects)
    if (typeof s.id !== 'string' || typeof s.name !== 'string' || !Array.isArray(s.folders))
        throw Error('Invalid subject'); for (const r of d.resources) {
    if (typeof r.id !== 'string' || !d.subjects.some((s: Subject) => s.id === r.subject) || !Array.isArray(r.pages) || !Array.isArray(r.chat))
        throw Error('Invalid document');
    for (const p of r.pages) {
        if (typeof p.text !== 'string' || !Array.isArray(p.strokes))
            throw Error('Invalid page');
        p.commands = validateCommands(p.commands || []);
    }
    if (r.lesson) {
        r.lesson.commands = validateCommands(r.lesson.commands);
        r.lesson.index = Math.min(r.lesson.commands.length, Math.max(0, Number(r.lesson.index) || 0));
    }
    if (r.data)
        r.data = Uint8Array.from(atob(r.data), (c: string) => c.charCodeAt(0)).buffer;
} return d; }
