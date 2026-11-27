import type { Resource } from './core';
export async function snapshot(resource: Resource, page: number): Promise<string> { const p = resource.pages[page]; const source = document.querySelector('#study-paper-'+page+' canvas') as HTMLCanvasElement | null; const c = document.createElement('canvas'); c.width = 900; c.height = Math.min(1500, 900 / (p.ratio || .74)); const ctx = c.getContext('2d')!; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, c.width, c.height); if (source)
    ctx.drawImage(source, 0, 0, c.width, c.height);
else if (p.image) {
    const img = new Image();
    img.src = p.image;
    await img.decode();
    ctx.drawImage(img, 0, 0, c.width, c.height);
}
else {
    ctx.fillStyle = '#263b35';
    ctx.font = '20px Arial';
    ctx.fillText(resource.name, 35, 45);
    p.text.split('\n').slice(0, 40).forEach((line, i) => ctx.fillText(line.slice(0, 90), 35, 85 + i * 27));
} for (const stroke of p.strokes) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * c.width / 1000;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    stroke.points.forEach(([x, y], i) => { if (i)
        ctx.lineTo(x / 1000 * c.width, y / 1000 * c.height);
    else
        ctx.moveTo(x / 1000 * c.width, y / 1000 * c.height); });
    ctx.stroke();
} return c.toDataURL('image/jpeg', .7); }
