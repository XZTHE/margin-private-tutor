import { strFromU8 } from 'fflate';
const parse = (v: Uint8Array | undefined) => new DOMParser().parseFromString(v ? strFromU8(v) : '<root/>', 'application/xml');
const elements = (e: Element | Document, tag: string) => Array.from(e.getElementsByTagName(tag));
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
function path(base: string, target: string) { const parts = (base + target).split('/'); const result: string[] = []; for (const p of parts)
    if (p === '..')
        result.pop();
    else if (p && p !== '.')
        result.push(p); return result.join('/'); }
export function renderSlide(files: Record<string, Uint8Array>, name: string): string { const xml = parse(files[name]); const presentation = parse(files['ppt/presentation.xml']); const size = elements(presentation, 'p:sldSz')[0]; const width = Number(size?.getAttribute('cx')) || 9144000, height = Number(size?.getAttribute('cy')) || 6858000; const relName = name.replace('slides/', 'slides/_rels/') + '.rels'; const rels = parse(files[relName]); const relationships = new Map(elements(rels, 'Relationship').map(e => [e.getAttribute('Id'), e.getAttribute('Target') || ''])); let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="${1200 * height / width}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>`; for (const shape of [...elements(xml, 'p:sp'), ...elements(xml, 'p:pic')]) {
    const transform = elements(shape, 'a:xfrm')[0];
    const off = transform && elements(transform, 'a:off')[0], ext = transform && elements(transform, 'a:ext')[0];
    if (!off || !ext)
        continue;
    const x = Number(off.getAttribute('x')) || 0, y = Number(off.getAttribute('y')) || 0, w = Number(ext.getAttribute('cx')) || 1, h = Number(ext.getAttribute('cy')) || 1;
    const blip = elements(shape, 'a:blip')[0];
    if (blip) {
        const target = relationships.get(blip.getAttribute('r:embed'));
        const bytes = target && files[path('ppt/slides/', target)];
        if (bytes) {
            const suffix = target.split('.').pop()?.toLowerCase();
            const mime = suffix === 'png' ? 'image/png' : suffix === 'jpg' || suffix === 'jpeg' ? 'image/jpeg' : null;
            if (mime) {
                let binary = '';
                for (const b of bytes)
                    binary += String.fromCharCode(b);
                svg += `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" xlink:href="data:${mime};base64,${btoa(binary)}"/>`;
            }
        }
        continue;
    }
    const props = elements(shape, 'p:spPr')[0];
    const fill = props && Array.from(props.children).find(c => c.tagName === 'a:solidFill');
    const rgb = fill && elements(fill, 'a:srgbClr')[0]?.getAttribute('val');
    const geometry = props && elements(props, 'a:prstGeom')[0]?.getAttribute('prst');
    const safeColor = rgb && /^[0-9a-f]{6}$/i.test(rgb) ? '#' + rgb : 'none';
    if (geometry === 'ellipse')
        svg += `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${safeColor}"/>`;
    else if (safeColor !== 'none')
        svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${safeColor}"/>`;
    let lineY = y;
    for (const paragraph of elements(shape, 'a:p')) {
        const runs = elements(paragraph, 'a:r');
        const defaultProps = elements(paragraph, 'a:defRPr')[0];
        const defaultSize = Number(defaultProps?.getAttribute('sz') || 2400) * 127;
        let lineSize = defaultSize;
        let content = '';
        for (const run of runs) {
            const rp = elements(run, 'a:rPr')[0];
            const fs = Number(rp?.getAttribute('sz') || 2400) * 127;
            lineSize = Math.max(lineSize, fs);
            const color = rp && elements(rp, 'a:srgbClr')[0]?.getAttribute('val');
            content += `<tspan font-size="${fs}" fill="${color && /^[0-9a-f]{6}$/i.test(color) ? '#' + color : '#263b35'}" font-weight="${rp?.getAttribute('b') === '1' ? 'bold' : 'normal'}">${escape(elements(run, 'a:t').map(t => t.textContent || '').join(''))}</tspan>`;
        }
        lineY += lineSize * 1.2;
        svg += `<text x="${x + 91440}" y="${lineY}" font-family="Arial,sans-serif">${content}</text>`;
    }
} svg += '</svg>'; return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
