import { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import type { Command, Page, Resource, Stroke } from './core';
import { TextLayer } from 'pdfjs-dist';
import { pdfDocument } from './importers';
export function Board({ resource, page, tool, color, onPage, commands, progress, onSelection }: {
    resource: Resource;
    page: number;
    tool: string;
    color: string;
    onPage: (p: Page) => void;
    commands: Command[];
    progress: number;
    onSelection: (s: string) => void;
}) { const p = resource.pages[page]; const canvas = useRef<HTMLCanvasElement>(null); const textLayer = useRef<HTMLDivElement>(null); const svg = useRef<SVGSVGElement>(null); const [draft, setDraft] = useState<Stroke | null>(null); const [region, setRegion] = useState<number[][]>([]); const [error, setError] = useState(''); useEffect(() => { let disposed = false; let task: any; let observer: ResizeObserver | undefined; setError(''); if (resource.kind === 'pdf' && resource.data)
    pdfDocument(resource.data).then(async (pdf) => { const pg = await pdf.getPage(page + 1); if (disposed) {
        await pdf.destroy();
        return;
    } const viewport = pg.getViewport({ scale: 1.5 }); if (textLayer.current) {
        const container = textLayer.current;
        container.innerHTML = '';
        container.style.setProperty('--scale-factor', '1.5');
        const layer = new TextLayer({ textContentSource: await pg.getTextContent(), container, viewport });
        await layer.render();
        container.style.width = viewport.width + 'px';
        container.style.height = viewport.height + 'px';
        const resize = () => { if (container.parentElement)
            container.style.transform = `scale(${container.parentElement.clientWidth / viewport.width})`; };
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(container.parentElement!);
        if (disposed)
            observer.disconnect();
    } const c = canvas.current; if (c) {
        c.width = viewport.width;
        c.height = viewport.height;
        task = pg.render({ canvasContext: c.getContext('2d')!, viewport });
        try {
            await task.promise;
        }
        catch (e) {
            if (!disposed)
                setError(String(e));
        }
    } await pdf.destroy(); }).catch(e => !disposed && setError(String(e))); return () => { disposed = true; task?.cancel(); observer?.disconnect(); }; }, [resource.id, page]); function point(e: React.PointerEvent) { const r = svg.current!.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1000, (e.clientY - r.top) / r.height * 1000]; } function down(e: React.PointerEvent<SVGSVGElement>) { if (e.pointerType === 'touch' && tool !== 'select')
    return; svg.current!.setPointerCapture(e.pointerId); const pt = point(e); if (tool === 'pen')
    setDraft({ id: crypto.randomUUID(), points: [pt], width: e.pointerType === 'pen' ? Math.max(1, e.pressure * 5) : 2, color });
else if (tool === 'region')
    setRegion([pt, pt]);
else if (tool === 'eraser')
    erase(pt);
else if (tool === 'text') {
    const text = prompt('Add text');
    if (text)
        onPage({ ...p, commands: [...p.commands, { id: crypto.randomUUID(), type: 'write_text', text, x: pt[0], y: pt[1], x2: 0, y2: 0 }] });
} } function erase(pt: number[]) { onPage({ ...p, strokes: p.strokes.filter(s => !s.points.some(v => Math.hypot(v[0] - pt[0], v[1] - pt[1]) < 20)), commands: p.commands.filter(c => Math.hypot(c.x - pt[0], c.y - pt[1]) > 50) }); } function move(e: React.PointerEvent) { if (!e.buttons)
    return; const pt = point(e); if (draft)
    setDraft({ ...draft, points: [...draft.points, pt] }); if (region.length)
    setRegion([region[0], pt]); if (tool === 'eraser')
    erase(pt); } function up() { if (draft) {
    onPage({ ...p, strokes: [...p.strokes, draft] });
    setDraft(null);
} if (region.length) {
    onSelection(`Selected region: x=${Math.round(Math.min(region[0][0], region[1][0]))}, y=${Math.round(Math.min(region[0][1], region[1][1]))}, width=${Math.round(Math.abs(region[1][0] - region[0][0]))}, height=${Math.round(Math.abs(region[1][1] - region[0][1]))}`);
} } const all = [...p.commands, ...commands]; return <div className="paper" id="study-paper" style={{ aspectRatio: p.ratio || 0.74 }} onMouseUp={() => { if (tool === 'select') {
    const text = window.getSelection()?.toString();
    if (text)
        onSelection(text.slice(0, 6000));
} }}><div className="paper-content">{resource.kind === 'pdf' ? <><canvas ref={canvas}/><div ref={textLayer} className={'pdf-text-layer ' + (tool === 'select' ? 'enabled' : '')}/></> : p.image ? <img src={p.image} alt={resource.name}/> : <div className={resource.kind === 'note' ? 'ruled' : 'slide-text'}>{resource.kind === 'note' ? <div className="note-heading">{resource.name}</div> : <><small>SLIDE {page + 1} · TEXT VIEW</small><pre>{p.text}</pre></>}</div>}{error && <p className="error">{error}</p>}</div><svg ref={svg} viewBox="0 0 1000 1000" preserveAspectRatio="none" className={'ink-layer ' + tool} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDraft(null)}><defs><marker id="teacherArrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0 0 L10 4 L0 8 Z" fill="#276e61"/></marker></defs>{[...p.strokes, ...(draft ? [draft] : [])].map(s => <polyline key={s.id} points={s.points.map(p => p.join(',')).join(' ')} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round"/>)}{all.map((c, i) => { const text = i === all.length - 1 ? c.text.slice(0, Math.ceil(c.text.length * progress)) : c.text; return <g key={c.id} className="teacher-ink">{c.type === 'write_text' || c.type === 'explain_step' ? <foreignObject x={c.x} y={c.y} width={950 - c.x} height="180"><div className="written" dir="auto">{text}</div></foreignObject> : c.type === 'write_equation' ? <foreignObject x={c.x} y={c.y} width={950 - c.x} height="120"><div className="equation" dangerouslySetInnerHTML={{ __html: katex.renderToString(text, { throwOnError: false, strict: false }) }}/></foreignObject> : c.type === 'draw_line' || c.type === 'draw_arrow' ? <><line x1={c.x} y1={c.y} x2={c.x + (c.x2 - c.x) * (i === all.length - 1 ? progress : 1)} y2={c.y + (c.y2 - c.y) * (i === all.length - 1 ? progress : 1)} markerEnd={c.type === 'draw_arrow' ? 'url(#teacherArrow)' : undefined} stroke="#276e61" strokeWidth="3"/></> : c.type === 'circle_region' ? <ellipse cx={(c.x + c.x2) / 2} cy={(c.y + c.y2) / 2} rx={Math.abs(c.x2 - c.x) / 2} ry={Math.abs(c.y2 - c.y) / 2} fill="none" stroke="#276e61" strokeWidth="3"/> : c.type === 'draw_shape' || c.type === 'highlight_region' ? <rect x={Math.min(c.x, c.x2)} y={Math.min(c.y, c.y2)} width={Math.abs(c.x2 - c.x)} height={Math.abs(c.y2 - c.y)} fill={c.type === 'highlight_region' ? '#f8dd5e55' : 'none'} stroke="#276e61" strokeWidth="2"/> : null}</g>; })}{region.length === 2 && <rect x={Math.min(region[0][0], region[1][0])} y={Math.min(region[0][1], region[1][1])} width={Math.abs(region[1][0] - region[0][0])} height={Math.abs(region[1][1] - region[0][1])} fill="#3f8a6633" stroke="#276e61" strokeDasharray="5 5"/>}</svg></div>; }
