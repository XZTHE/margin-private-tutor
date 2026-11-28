import { useEffect, useRef, useState } from 'react';
import { exportLibrary, importLibrary, type Library } from './core';
interface BackupInfo {
    available: boolean;
    folder: string;
    revision: string;
    savedAt: string | null;
    hasBackup: boolean;
    hasPrevious: boolean;
    newestDocument: number;
}
export function useICloudBackup(library: Library, ready: boolean, onRestore: (data: Library) => void) { const [info, setInfo] = useState<BackupInfo | null>(null); const [state, setState] = useState<'checking' | 'unavailable' | 'ready' | 'saving' | 'saved' | 'error' | 'restore-first'>('checking'); const [error, setError] = useState(''); const restoreCallback=useRef(onRestore);restoreCallback.current=onRestore; const revision = useRef('none'); const current = useRef(library); current.current = library; const pending = useRef(false); const queued = useRef(false); const restoring = useRef(false); const saveRef = useRef<() => Promise<void>>(async () => { }); const token = () => document.querySelector<HTMLMetaElement>('meta[name="margin-local-backup-token"]')?.content || ''; const local = import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname); async function request(path: string, init: RequestInit = {}) { const response = await fetch('/__margin/icloud/' + path, { ...init, headers: { ...init.headers, 'X-Margin-Backup-Token': token() } }); const body = await response.json(); if (!response.ok)
    throw Error(body.error || 'iCloud backup failed'); return body; } useEffect(() => { if (!ready)
    return; let cancelled = false; if (!local || !token()) {
    setState('unavailable');
    return;
} request('status').then(async (value: BackupInfo) => {
  if(cancelled)return;
  revision.current=value.revision;
  if(value.hasBackup&&current.current.resources.length===0){
    restoring.current=true;setState('saving');
    try{
      const raw=await request('restore');
      const data=importLibrary(JSON.stringify(raw));
      if(cancelled)return;
      // Never replace notes made while the backup was being read.
      if(current.current.resources.length===0){
        restoreCallback.current(data);
        const latest:BackupInfo=await request('status');
        if(cancelled)return;
        revision.current=latest.revision;setInfo(latest);setState(latest.revision===value.revision?'ready':'restore-first');
      }else{setInfo(value);setState('restore-first');}
    }finally{restoring.current=false;}
    return;
  }
  setInfo(value);
  const newest=Math.max(0,...current.current.resources.map(r=>r.updated));
  setState(value.hasBackup&&value.newestDocument>newest?'restore-first':'ready');
}).catch(e => { if (!cancelled) {
    setError(e.message);
    setState('unavailable');
} }); return () => { cancelled = true; }; }, [ready]); saveRef.current = async () => { if (!info || restoring.current || current.current.prefs.icloudBackup === false || state === 'restore-first')
    return; if (pending.current) {
    queued.current = true;
    return;
} pending.current = true; setState('saving'); try {
    const lib = current.current;
    const data = await serializeICloudBackup(lib);
    const value = await request('backup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'If-Match': revision.current }, body: data });
    revision.current = value.revision;
    setInfo(value);
    setError('');
    setState('saved');
}
catch (e: any) {
    setError(e.message);
    setState('error');
    queued.current = false;
}
finally {
    pending.current = false;
    if (queued.current) {
        queued.current = false;
        void saveRef.current();
    }
} }; useEffect(() => { if (!ready || !info || library.prefs.icloudBackup === false || state === 'restore-first' || restoring.current)
    return; const timer = setTimeout(() => void saveRef.current(), 3000); return () => clearTimeout(timer); }, [library, ready, !!info]); async function restore(previous = false) { if (pending.current)
    throw Error('انتظر اكتمال النسخ الاحتياطي أولًا.'); restoring.current = true; setState('saving'); try {
    const raw = await request('restore' + (previous ? '?version=previous' : ''));
    const data = importLibrary(JSON.stringify(raw));
    onRestore(data);
    const value = await request('status');
    revision.current = value.revision;
    setInfo(value);
    setError('');
    setState('ready');
}
catch (e: any) {
    setError(e.message);
    setState('error');
    throw e;
}
finally {
    restoring.current = false;
} } return { info, state, error, enabled: library.prefs.icloudBackup !== false, saveNow: () => saveRef.current(), restore }; }
export async function serializeICloudBackup(lib: Library) { const safe = { ...lib, prefs: { ui: lib.prefs.ui, endpoint: lib.prefs.endpoint, geminiModel: lib.prefs.geminiModel, conversation: lib.prefs.conversation, explanation: lib.prefs.explanation, writing: lib.prefs.writing, icloudBackup: lib.prefs.icloudBackup, eraserMode: lib.prefs.eraserMode, eraserSize: lib.prefs.eraserSize, penSize: lib.prefs.penSize, penColor: lib.prefs.penColor, penSmoothing: lib.prefs.penSmoothing } }; return exportLibrary(safe); }
