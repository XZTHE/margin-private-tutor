import * as pdfjs from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { unzipSync, strFromU8 } from 'fflate';
import { renderSlide } from './pptx';
import type { Page, Resource } from './core';
pdfjs.GlobalWorkerOptions.workerSrc = worker;
export const blank = (): Page => ({ text: '', strokes: [], commands: [] });
export async function pdfDocument(data: ArrayBuffer) { return pdfjs.getDocument({ data: data.slice(0) }).promise; }
export async function importFile(file: File, subject: string, folder: string): Promise<Resource> { if (file.size > 40 * 1024 * 1024)
    throw Error('Please use files smaller than 40 MB.'); const data = await file.arrayBuffer(); const ext = file.name.split('.').pop()?.toLowerCase(); const r: Resource = { id: crypto.randomUUID(), subject, folder, name: file.name, kind: ext || '', pages: [], data, updated: Date.now(), chat: [] }; if (ext === 'pdf') {
    const pdf = await pdfDocument(data);
    for (let n = 1; n <= pdf.numPages; n++) {
        const p = await pdf.getPage(n);
        const t = await p.getTextContent();
        r.pages.push({ ...blank(), ratio: p.getViewport({ scale: 1 }).width / p.getViewport({ scale: 1 }).height, text: t.items.map(i => 'str' in i ? i.str : '').join(' ') });
    }
    await pdf.destroy();
}
else if (['png', 'jpg', 'jpeg'].includes(ext || '')) {
    const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const img = new Image();
    img.src = image;
    await img.decode();
    r.pages = [{ ...blank(), image, ratio: img.naturalWidth / img.naturalHeight }];
}
else if (ext === 'pptx') {
    const files = unzipSync(new Uint8Array(data));
    const pres = files['ppt/presentation.xml'] && new DOMParser().parseFromString(strFromU8(files['ppt/presentation.xml']), 'application/xml');
    const sz = pres?.getElementsByTagName('p:sldSz')[0];
    const ratio = sz ? Number(sz.getAttribute('cx')) / Number(sz.getAttribute('cy')) : 4 / 3;
    const names = Object.keys(files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]));
    for (const name of names) {
        const xml = new DOMParser().parseFromString(strFromU8(files[name]), 'application/xml');
        const text = Array.from(xml.getElementsByTagName('a:t')).map(e => e.textContent).join('\n');
        r.pages.push({ ...blank(), text, image: renderSlide(files, name), ratio });
    }
    if (!r.pages.length)
        throw Error('No slides found in this PPTX.');
}
else
    throw Error('Supported formats: PDF, PPTX, PNG and JPEG.'); return r; }
