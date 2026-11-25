import type { Command } from './core';
const types = ['write_text', 'write_equation', 'draw_line', 'draw_arrow', 'draw_shape', 'highlight_region', 'circle_region', 'erase_element', 'explain_step'];
export function validateCommands(value: unknown): Command[] { if (!Array.isArray(value) || value.length > 50)
    throw Error('Invalid lesson command count'); return value.map((c: any) => { if (!c || !types.includes(c.type) || typeof c.id !== 'string' || c.id.length > 80 || typeof c.text !== 'string' || c.text.length > 2000)
    throw Error('Invalid lesson command'); for (const k of ['x', 'y', 'x2', 'y2'])
    if (typeof c[k] !== 'number' || !Number.isFinite(c[k]) || c[k] < 0 || c[k] > 1000)
        throw Error('Invalid annotation position'); return c as Command; }); }
