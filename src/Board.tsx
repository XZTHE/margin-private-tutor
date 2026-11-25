import { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import type { Command, Page, Resource, Stroke } from './core';
import { TextLayer } from 'pdfjs-dist';
import { pdfDocument } from './importers';

interface BoardProps {
  resource: Resource;
  page: number;
  tool: string;
  color: string;
  penWidth?: number;
  onPage: (p: Page) => void;
  commands: Command[];
  progress: number;
  onSelection: (s: string) => void;
}

export function Board({
  resource,
  page,
  tool,
  color,
  penWidth = 2.5,
  onPage,
  commands,
  progress,
  onSelection,
}: BoardProps) {
  const p = resource.pages[page];
  const canvas = useRef<HTMLCanvasElement>(null);
  const textLayer = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  const [draft, setDraft] = useState<Stroke | null>(null);
  const [region, setRegion] = useState<number[][]>([]);
  const [error, setError] = useState('');

  // Refs to avoid stale closures and unreliable e.buttons on iPad Safari
  const activePointerId = useRef<number | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const regionRef = useRef<number[][]>([]);
  const pageRef = useRef<Page>(p);
  pageRef.current = p;

  // Render PDF page & text layer
  useEffect(() => {
    let disposed = false;
    let task: any;
    let observer: ResizeObserver | undefined;
    setError('');
    if (resource.kind === 'pdf' && resource.data) {
      pdfDocument(resource.data)
        .then(async (pdf) => {
          const pg = await pdf.getPage(page + 1);
          if (disposed) {
            await pdf.destroy();
            return;
          }
          // Higher render scale for crisp iPad Retina display
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const renderScale = 1.5 * dpr;
          const viewport = pg.getViewport({ scale: renderScale });

          if (textLayer.current) {
            const container = textLayer.current;
            container.innerHTML = '';
            container.style.setProperty('--scale-factor', String(renderScale));
            const layer = new TextLayer({
              textContentSource: await pg.getTextContent(),
              container,
              viewport,
            });
            await layer.render();
            container.style.width = viewport.width + 'px';
            container.style.height = viewport.height + 'px';
            const resize = () => {
              if (container.parentElement) {
                container.style.transform = `scale(${container.parentElement.clientWidth / viewport.width})`;
              }
            };
            resize();
            observer = new ResizeObserver(resize);
            observer.observe(container.parentElement!);
            if (disposed) observer.disconnect();
          }

          const c = canvas.current;
          if (c) {
            c.width = viewport.width;
            c.height = viewport.height;
            task = pg.render({ canvasContext: c.getContext('2d')!, viewport });
            try {
              await task.promise;
            } catch (e) {
              if (!disposed) setError(String(e));
            }
          }
          await pdf.destroy();
        })
        .catch((e) => !disposed && setError(String(e)));
    }
    return () => {
      disposed = true;
      task?.cancel();
      observer?.disconnect();
    };
  }, [resource.id, page]);

  // Native non-passive touch listeners for iPad Safari Apple Pencil support.
  // iPadOS Safari fires TouchEvents for Apple Pencil with touchType === 'stylus'.
  // Preventing default on stylus touchstart/touchmove stops Safari from hijacking
  // Apple Pencil strokes for scrolling, overscroll, or sidebar/back gestures,
  // while keeping 1-finger scrolling and 2-finger pinch-to-zoom working smoothly.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;

    const handleTouch = (e: TouchEvent) => {
      if (tool === 'select') return;
      const hasStylus = Array.from(e.touches).some(
        (t) => (t as Touch & { touchType?: string }).touchType === 'stylus'
      );
      if (hasStylus) {
        e.preventDefault();
      }
    };

    el.addEventListener('touchstart', handleTouch, { passive: false });
    el.addEventListener('touchmove', handleTouch, { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouch);
      el.removeEventListener('touchmove', handleTouch);
    };
  }, [tool]);

  function getNormalizedPoint(e: React.PointerEvent<SVGSVGElement>): [number, number] {
    const r = svg.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1000, ((e.clientX - r.left) / r.width) * 1000));
    const y = Math.max(0, Math.min(1000, ((e.clientY - r.top) / r.height) * 1000));
    return [x, y];
  }

  function eraseAt(pt: [number, number]) {
    const cur = pageRef.current;
    const nextStrokes = cur.strokes.filter(
      (s) => !s.points.some((v) => Math.hypot(v[0] - pt[0], v[1] - pt[1]) < 22)
    );
    const nextCommands = cur.commands.filter(
      (c) => Math.hypot(c.x - pt[0], c.y - pt[1]) > 50
    );
    if (nextStrokes.length !== cur.strokes.length || nextCommands.length !== cur.commands.length) {
      onPage({ ...cur, strokes: nextStrokes, commands: nextCommands });
    }
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // Allow finger touch to scroll & pinch-zoom; only Apple Pencil ('pen') and mouse draw
    if (e.pointerType === 'touch') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (tool === 'select') return;

    e.preventDefault();
    e.stopPropagation();

    activePointerId.current = e.pointerId;
    try {
      svg.current?.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }

    const pt = getNormalizedPoint(e);

    if (tool === 'pen') {
      const pressureWidth =
        e.pointerType === 'pen' && e.pressure > 0
          ? Math.max(1.2, Math.min(7, e.pressure * penWidth * 2))
          : penWidth;
      const stroke: Stroke = {
        id: crypto.randomUUID(),
        points: [pt],
        width: pressureWidth,
        color,
      };
      draftRef.current = stroke;
      setDraft(stroke);
    } else if (tool === 'region') {
      const nextRegion = [pt, pt];
      regionRef.current = nextRegion;
      setRegion(nextRegion);
    } else if (tool === 'eraser') {
      eraseAt(pt);
    } else if (tool === 'text') {
      activePointerId.current = null;
      const text = prompt('Add text');
      if (text) {
        const cur = pageRef.current;
        onPage({
          ...cur,
          commands: [
            ...cur.commands,
            {
              id: crypto.randomUUID(),
              type: 'write_text',
              text,
              x: pt[0],
              y: pt[1],
              x2: 0,
              y2: 0,
            },
          ],
        });
      }
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (activePointerId.current === null || e.pointerId !== activePointerId.current) return;

    e.preventDefault();
    const pt = getNormalizedPoint(e);

    if (draftRef.current) {
      const updated: Stroke = {
        ...draftRef.current,
        points: [...draftRef.current.points, pt],
      };
      draftRef.current = updated;
      setDraft(updated);
    } else if (regionRef.current.length) {
      const updated = [regionRef.current[0], pt];
      regionRef.current = updated;
      setRegion(updated);
    } else if (tool === 'eraser') {
      eraseAt(pt);
    }
  }

  function finishPointer(e: React.PointerEvent<SVGSVGElement>) {
    if (activePointerId.current === null || e.pointerId !== activePointerId.current) return;
    activePointerId.current = null;

    try {
      if (svg.current?.hasPointerCapture(e.pointerId)) {
        svg.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    if (draftRef.current) {
      const finished = draftRef.current;
      draftRef.current = null;
      setDraft(null);
      const cur = pageRef.current;
      onPage({ ...cur, strokes: [...cur.strokes, finished] });
    }

    if (regionRef.current.length === 2) {
      const [p1, p2] = regionRef.current;
      onSelection(
        `Selected region: x=${Math.round(Math.min(p1[0], p2[0]))}, y=${Math.round(
          Math.min(p1[1], p2[1])
        )}, width=${Math.round(Math.abs(p2[0] - p1[0]))}, height=${Math.round(
          Math.abs(p2[1] - p1[1])
        )}`
      );
      regionRef.current = [];
      setRegion([]);
    }
  }

  function cancelPointer(e: React.PointerEvent<SVGSVGElement>) {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    draftRef.current = null;
    regionRef.current = [];
    setDraft(null);
    setRegion([]);
  }

  const all = [...p.commands, ...commands];

  return (
    <div
      className="paper"
      id="study-paper"
      style={{ aspectRatio: p.ratio || 0.74 }}
      onMouseUp={() => {
        if (tool === 'select') {
          const text = window.getSelection()?.toString();
          if (text) onSelection(text.slice(0, 6000));
        }
      }}
    >
      <div className="paper-content">
        {resource.kind === 'pdf' ? (
          <>
            <canvas ref={canvas} />
            <div
              ref={textLayer}
              className={'pdf-text-layer ' + (tool === 'select' ? 'enabled' : '')}
            />
          </>
        ) : p.image ? (
          <img src={p.image} alt={resource.name} draggable={false} />
        ) : (
          <div className={resource.kind === 'note' ? 'ruled' : 'slide-text'}>
            {resource.kind === 'note' ? (
              <div className="note-heading">{resource.name}</div>
            ) : (
              <>
                <small>SLIDE {page + 1} · TEXT VIEW</small>
                <pre>{p.text}</pre>
              </>
            )}
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      <svg
        ref={svg}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className={'ink-layer ' + tool}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={cancelPointer}
        onLostPointerCapture={cancelPointer}
      >
        <defs>
          <marker
            id="teacherArrow"
            markerWidth="10"
            markerHeight="8"
            refX="8"
            refY="4"
            orient="auto"
          >
            <path d="M0 0 L10 4 L0 8 Z" fill="#0a7ea4" />
          </marker>
        </defs>
        {[...p.strokes, ...(draft ? [draft] : [])].map((s) => (
          <polyline
            key={s.id}
            points={s.points.map((pt) => pt.join(',')).join(' ')}
            stroke={s.color}
            strokeWidth={s.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {all.map((c, i) => {
          const text =
            i === all.length - 1
              ? c.text.slice(0, Math.ceil(c.text.length * progress))
              : c.text;
          return (
            <g key={c.id} className="teacher-ink">
              {c.type === 'write_text' || c.type === 'explain_step' ? (
                <foreignObject x={c.x} y={c.y} width={950 - c.x} height="180">
                  <div className="written" dir="auto">
                    {text}
                  </div>
                </foreignObject>
              ) : c.type === 'write_equation' ? (
                <foreignObject x={c.x} y={c.y} width={950 - c.x} height="120">
                  <div
                    className="equation"
                    dangerouslySetInnerHTML={{
                      __html: katex.renderToString(text, {
                        throwOnError: false,
                        strict: false,
                      }),
                    }}
                  />
                </foreignObject>
              ) : c.type === 'draw_line' || c.type === 'draw_arrow' ? (
                <line
                  x1={c.x}
                  y1={c.y}
                  x2={c.x + (c.x2 - c.x) * (i === all.length - 1 ? progress : 1)}
                  y2={c.y + (c.y2 - c.y) * (i === all.length - 1 ? progress : 1)}
                  markerEnd={c.type === 'draw_arrow' ? 'url(#teacherArrow)' : undefined}
                  stroke="#0a7ea4"
                  strokeWidth="3"
                />
              ) : c.type === 'circle_region' ? (
                <ellipse
                  cx={(c.x + c.x2) / 2}
                  cy={(c.y + c.y2) / 2}
                  rx={Math.abs(c.x2 - c.x) / 2}
                  ry={Math.abs(c.y2 - c.y) / 2}
                  fill="none"
                  stroke="#0a7ea4"
                  strokeWidth="3"
                />
              ) : c.type === 'draw_shape' || c.type === 'highlight_region' ? (
                <rect
                  x={Math.min(c.x, c.x2)}
                  y={Math.min(c.y, c.y2)}
                  width={Math.abs(c.x2 - c.x)}
                  height={Math.abs(c.y2 - c.y)}
                  fill={c.type === 'highlight_region' ? '#ffe06666' : 'none'}
                  stroke="#0a7ea4"
                  strokeWidth="2"
                />
              ) : null}
            </g>
          );
        })}
        {region.length === 2 && (
          <rect
            x={Math.min(region[0][0], region[1][0])}
            y={Math.min(region[0][1], region[1][1])}
            width={Math.abs(region[1][0] - region[0][0])}
            height={Math.abs(region[1][1] - region[0][1])}
            fill="#007aff22"
            stroke="#007aff"
            strokeDasharray="5 5"
          />
        )}
      </svg>
    </div>
  );
}
