import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BookOpen,
  Plus,
  Upload,
  FileText,
  Folder,
  PenLine,
  MousePointer2,
  Eraser,
  Type,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Settings,
  Download,
  Search,
  Play,
  Pause,
  SkipBack,
  Trash2,
  ArrowLeft,
  Maximize2,
  Minimize2,
  X,
  Eye,
  EyeOff,
  Undo2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  SquarePen,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Menu,
} from 'lucide-react';
import {
  read,
  save,
  initial,
  exportLibrary,
  importLibrary,
  retrieve,
  visibleCommands,
  type Library,
  type Resource,
  type Page,
} from './core';
import { blank, importFile } from './importers';
import { Board } from './Board';
import { NotebookPage } from './NotebookPage';
import { FloatingChatButton } from './FloatingChatButton';
import { pageTurnGesture,resolveBookFold } from './book';
import {PaperCurl,capturePaper,type CurlDriver,type PaperSnapshot} from './PaperCurl';
import { useICloudBackup } from './icloud';
import {shouldCompleteFold} from './curl-geometry';
import { snapshot } from './snapshot';
import {
  askGeminiDirect,
  GeminiBillingError,
  resumeGeminiRequests,
  listGeminiModels,
  testGeminiConnection,
  type GeminiModelInfo,
} from './gemini';
import 'katex/dist/katex.min.css';
import './style.css';
import { translateTree } from './i18n';

import {selectionRect,findAnswerArea,fitAnswerCommands,readPageGeometry,compactPageLayout,type Rect} from './placement';
import {detectApiProvider, selectEconomyModel} from './api-detection';

const INK_COLORS = ['#1d1d1f', '#007aff', '#d70015', '#248a3d', '#8944ab'];

function App() {
  const [lib, setLib] = useState<Library>(initial);
  const [ready, setReady] = useState(false);
  const [subject, setSubject] = useState('start');
  const [active, setActive] = useState('');
  const [folder, setFolder] = useState('');
  const [page, setPage] = useState(0);
  const [curl, setCurl] = useState<PaperSnapshot|null>(null);
  const [curlDriver,setCurlDriver]=useState<CurlDriver|null>(null);
  const [dragTarget,setDragTarget]=useState<number|null>(null);
  const [pendingBlank,setPendingBlank]=useState<Page|null>(null);
  const foldDrag=useRef<{id:number|null;owner:HTMLButtonElement;newPage:Page|null;from:number;target:number;direction:1|-1;rect:DOMRect;startX:number;startY:number;lastX:number;lastTime:number;velocity:number;driver:CurlDriver}|null>(null);
  useEffect(()=>{const up=(e:PointerEvent)=>finishFoldInput(e);const cancel=(e:PointerEvent)=>finishFoldInput(e,true);const blur=()=>{const drag=foldDrag.current;if(drag?.id!=null)finishFoldInput({pointerId:drag.id,clientX:0,clientY:0},true)};window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);window.addEventListener('blur',blur);return()=>{window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancel,true);window.removeEventListener('blur',blur)}},[]);
  const swipeStart = useRef<{x:number;y:number;time:number}|null>(null);
  const [tool, setTool] = useState('pen');
  const [eraserMenu,setEraserMenu]=useState(false);
  const eraserHold=useRef<ReturnType<typeof setTimeout>|null>(null);
  const heldTool=useRef(false);
  const [color, setColor] = useState('#1d1d1f');
  const [zoom, setZoom] = useState(100);
  const [fitPage,setFitPage]=useState(false);
  const [zoomGesture,setZoomGesture]=useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  // Floating AI assistant state (closed by default so document is 100% focus)
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHidden,setChatHidden]=useState(()=>{try{return localStorage.getItem('margin-chat-hidden')==='1'}catch{return false}});
  const [chatExpanded, setChatExpanded] = useState(false);
  const [ai, setAi] = useState(false);

  // Settings & BYOK Gemini API key (memory-only for current session)
  const [settings, setSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [billingBlocked, setBillingBlocked] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<GeminiModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{
    state: 'idle' | 'testing' | 'ok' | 'error';
    message: string;
  }>({ state: 'idle', message: '' });

  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState('');
  const [pinnedAnswerArea, setPinnedAnswerArea] = useState<Rect>();
  const [busy, setBusy] = useState(false);
  const [attachPage, setAttachPage] = useState(false);
  const requestInFlight = useRef(false);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('Explain');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(1);
  const [search, setSearch] = useState('');
  const [whiteboard, setWhiteboard] = useState(false);
  useEffect(() => {setPinnedAnswerArea(undefined);}, [active, page, whiteboard]);

  const files = useRef<HTMLInputElement>(null);
  const backup = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

  const resource = lib.resources.find((r) => r.id === active);
  const viewPages=resource?(pendingBlank?[...resource.pages,pendingBlank]:resource.pages):[];
  const currentSubject = lib.subjects.find((s) => s.id === subject) || lib.subjects[0];
  const geminiModel = lib.prefs.geminiModel || '';
  const cloud = useICloudBackup(lib,ready,data=>{setLib(data);setSubject(data.subjects[0]?.id||'start');setActive('');setPage(0)});

  useEffect(() => {
    read()
      .then((d) => {
        setLib(d);
        setSubject(d.subjects[0]?.id || 'start');
        setReady(true);
      })
      .catch((e) => {
        setStatus('Local storage unavailable: ' + e.message);
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(
      () =>
        save(lib).catch((e) =>
          setStatus('Could not save locally. Export a backup: ' + e.message)
        ),
      300
    );
    return () => clearTimeout(t);
  }, [lib, ready]);

  // Pinch-to-zoom support on the document scroll container
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !resource) return;

    const getDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if(foldDrag.current)return;
      if (e.touches.length === 2) {
        setZoomGesture(true);
        pinchStart.current = {
          dist: getDist(e.touches[0], e.touches[1]),
          zoom,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if(foldDrag.current)return;
      if (e.touches.length === 2 && pinchStart.current) {
        e.preventDefault();
        const scale = getDist(e.touches[0], e.touches[1]) / pinchStart.current.dist;
        const next = Math.round(Math.max(50, Math.min(250, pinchStart.current.zoom * scale)));
        setZoom(next);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        setZoomGesture(false);
        pinchStart.current = null;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [resource, zoom]);

  function updateResource(fn: (r: Resource) => Resource) {
    setLib((l) => ({
      ...l,
      resources: l.resources.map((r) => (r.id === active ? fn(r) : r)),
    }));
  }

  function updatePage(p: Page, targetPage = page) {
    updateResource((r) => ({
      ...r,
      pages: r.pages.map((v, i) => (i === targetPage ? p : v)),
      updated: Date.now(),
    }));
  }

  function navigatePage(target: number) {
    if(target===page||foldDrag.current)return;
    setCurlDriver(null);
    setDragTarget(null);
    const paper=document.getElementById('study-paper-'+page);
    const stage=paper?.closest<HTMLElement>('.book-stage');
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setCurl(paper&&stage&&!reduce?capturePaper(paper,stage,target>page?1:-1):null);
    setPage(target);
    setPlaying(false);
    setSelection('');
    requestAnimationFrame(() => {if(scrollRef.current)scrollRef.current.scrollTop=0;});
  }

  function beginFold(e:React.PointerEvent<HTMLButtonElement>,direction:1|-1){
    if(curl||foldDrag.current||(e.pointerType==='mouse'&&e.button!==0)||!resource)return;
    const destination=resolveBookFold(page,resource.pages.length,resource.kind==='note',direction);if(!destination)return;
    const target=destination.target,newPage=destination.addPage?blank():null;
    const paper=document.getElementById('study-paper-'+page),stage=paper?.closest<HTMLElement>('.book-stage');if(!paper||!stage)return;
    e.preventDefault();e.stopPropagation();swipeStart.current=null;
    const snapshot=capturePaper(paper,stage,direction);if(!snapshot)return;
    const driver:CurlDriver={point:{x:direction===1?1:0,y:1},settle:null};
    foldDrag.current={id:e.pointerId,owner:e.currentTarget,newPage,from:page,target,direction,rect:paper.getBoundingClientRect(),startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastTime:performance.now(),velocity:0,driver};
    e.currentTarget.setPointerCapture(e.pointerId);setCurlDriver(driver);setPendingBlank(newPage);setDragTarget(target);setCurl(snapshot);setPlaying(false);setSelection('');
  }
  function updateFoldPosition(clientX:number,clientY:number){const drag=foldDrag.current;if(!drag)return;const now=performance.now();if(Math.abs(drag.lastX-clientX)>.5){drag.velocity=(drag.lastX-clientX)*drag.direction/Math.max(1,now-drag.lastTime);drag.lastX=clientX;drag.lastTime=now;}drag.driver.point={x:(drag.direction===1?1:0)+(clientX-drag.startX)/drag.rect.width,y:Math.min(1,1+(clientY-drag.startY)/drag.rect.height)};}
  function moveFold(e:React.PointerEvent<HTMLButtonElement>){const drag=foldDrag.current;if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();updateFoldPosition(e.clientX,e.clientY);}
  function finishFoldInput(e:{pointerId:number;clientX:number;clientY:number;preventDefault?:()=>void;stopPropagation?:()=>void},cancel=false){const drag=foldDrag.current;if(!drag||drag.id!==e.pointerId)return;e.preventDefault?.();e.stopPropagation?.();if(!cancel)updateFoldPosition(e.clientX,e.clientY);drag.id=null;const point=drag.driver.point;const travel=drag.direction===1?1-point.x:point.x;drag.driver.settle=!cancel&&shouldCompleteFold(travel,performance.now()-drag.lastTime<120?drag.velocity:0)?1:0;try{drag.owner.releasePointerCapture(e.pointerId)}catch{}}

  function finishFold(committed:boolean){const drag=foldDrag.current;if(drag&&committed){if(drag.newPage)updateResource(r=>({...r,pages:[...r.pages,drag.newPage!],updated:Date.now()}));setPage(drag.target);requestAnimationFrame(()=>{if(scrollRef.current)scrollRef.current.scrollTop=0})}foldDrag.current=null;setPendingBlank(null);setDragTarget(null);setCurlDriver(null);setCurl(null);}

  function addPageFromCorner(){if(!resource||resource.kind!=='note'||foldDrag.current)return;const target=resource.pages.length;updateResource(r=>({...r,pages:[...r.pages,blank()],updated:Date.now()}));navigatePage(target);}

  function open(r: Resource) {
    setActive(r.id);
    setCurl(null);
    setCurlDriver(null);
    setDragTarget(null);
    setPendingBlank(null);
    foldDrag.current=null;
    setPage(0);
    setZoom(100);
    setPlaying(false);
    setSelection('');
    setWhiteboard(false);
    setFullscreen(false);
    setChatOpen(false);
    setMobileNav(false);
  }

  function note() {
    const name = prompt('Note title', 'Untitled note');
    if (!name) return;
    const r: Resource = {
      id: crypto.randomUUID(),
      subject,
      folder,
      name,
      kind: 'note',
      pages: [blank()],
      updated: Date.now(),
      chat: [],
    };
    setLib((l) => ({ ...l, resources: [...l.resources, r] }));
    open(r);
  }

  async function importFiles(list: FileList | null) {
    if (!list) return;
    setBusy(true);
    try {
      for (const f of Array.from(list)) {
        setStatus('Importing ' + f.name + '…');
        const r = await importFile(f, subject, folder);
        setLib((l) => ({ ...l, resources: [...l.resources, r] }));
      }
      setStatus('Resources imported and indexed locally.');
    } catch (e) {
      setStatus(String(e));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!playing || !resource?.lesson) return;
    const lesson = resource.lesson;
    if (lesson.index >= lesson.commands.length) {
      setPlaying(false);
      return;
    }
    const cmd = lesson.commands[lesson.index];
    let tick = progress * Math.max(12, cmd.text.length);
    const steps = Math.max(12, cmd.text.length);
    const t = setInterval(() => {
      tick += speed;
      setProgress(Math.min(1, tick / steps));
      if (tick >= steps) {
        clearInterval(t);
        updateResource((r) => ({
          ...r,
          lesson: r.lesson ? { ...r.lesson, index: r.lesson.index + 1 } : undefined,
        }));
        setProgress(0);
        if (mode === 'Solve Together') setPlaying(false);
      }
    }, 35);
    return () => clearInterval(t);
  }, [playing, resource?.lesson?.index, speed, active]);

  async function ask(message = query) {
    if (!resource || !ai || busy || loadingModels || requestInFlight.current || !message.trim()) return;
    if (!apiKey.trim()) {
      setSettings(true);
      setStatus('Enter your personal Gemini API key in Settings to use the AI assistant.');
      return;
    }
    let activeModel = geminiModel;
    if (!activeModel || !models.some(m => m.id === activeModel)) {
      setSettings(true);
      setStatus('Select a Gemini model in Settings first. Prefer a Flash-Lite model for lower usage.');
      return;
    }
    requestInFlight.current = true;
    const id = active;
    setPlaying(false);
    setBusy(true);
    setQuery('');
    abort.current = new AbortController();
    const history = resource.chat.slice(-2);
    updateResource((r) => ({
      ...r,
      chat: [...r.chat, { role: 'student', text: message }],
    }));
    try {
      const context = retrieve(lib.resources, subject, message, active, page);
      const question = selectionRect(selection);
      const geometry = readPageGeometry(page);
      if (question && !pinnedAnswerArea && !geometry.blocks.length && resource.kind !== 'note') throw Error('للصفحات المصورة: حدد مساحة الحل الفارغة واضغط «اكتب الحل هنا»، ثم حدد السؤال واسأل المعلم.');
      const answerArea = pinnedAnswerArea || (question ? findAnswerArea(question, [...geometry.occupied, question]) : undefined);
      if (answerArea && (answerArea.width < 220 || answerArea.height < 100)) throw Error('مساحة الحل صغيرة. حدد مستطيلًا فارغًا أكبر قبل إرسال السؤال.');
      if (question && !answerArea) throw Error('لا توجد مساحة كافية قرب السؤال. حدد مساحة أخرى أو افتح اللوحة البيضاء قبل طلب الحل.');
      const needsImage = attachPage || mode === 'Practice' || (!resource.pages[page].text.trim() && resource.kind !== 'note');
      const image = needsImage ? await snapshot(resource, page) : undefined;
      const body = await askGeminiDirect({
        apiKey,
        model: activeModel,
        message,
        context,
        history,
        mode,
        languages: lib.prefs,
        selection,
        questionRegion: question,
        answerArea,
        pageLayout: compactPageLayout(geometry.blocks, question),
        lessonProgress: resource.lesson,
        currentPage: page + 1,
        currentFile: resource.name,
        image,
        studentWork: mode === 'Practice' ? resource.pages[page].strokes : undefined,
        signal: abort.current.signal,
      });
      const placedCommands = fitAnswerCommands(body.commands, answerArea);
      setLib((l) => ({
        ...l,
        resources: l.resources.map((r) =>
          r.id === id
            ? {
                ...r,
                chat: [...r.chat, { role: 'tutor', text: body.reply }],
                lesson: { commands: placedCommands, index: 0, page },
              }
            : r
        ),
      }));
      setProgress(0);
      setPlaying(true);
      setStatus('Lesson ready. You can pause at any step.');
    } catch (e: any) {
      if (e instanceof GeminiBillingError) { setBillingBlocked(true); setAi(false); setSettings(true); }
      setStatus(e?.message || String(e));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    const key = apiKey.trim();
    setBillingBlocked(false);
    setModels([]);
    if (!key) { setLoadingModels(false); return; }
    const provider = detectApiProvider(key);
    if (provider !== 'gemini') {
      setLoadingModels(false);
      setKeyStatus({state:'error',message:provider==='other'
        ? 'This appears to be another provider’s key. This app currently supports Gemini only; your key was not sent anywhere.'
        : 'Provider not recognized. Automatic detection supports Gemini AIza / AQ. keys. Your key was not sent anywhere.'});
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoadingModels(true);
    setKeyStatus({state:'testing',message:'Detecting Gemini and choosing an economical model…'});
    const timer = setTimeout(async () => {
      try {
        const available = await listGeminiModels(key, fetch, controller.signal);
        if (cancelled) return;
        setModels(available);
        const selected = selectEconomyModel(available);
        preference('geminiModel', selected);
        setKeyStatus({state:'ok',message:`Gemini detected · ${selected} selected. No text generation was used to check the key.`});
      } catch (e:any) {
        if (!cancelled) setKeyStatus({state:'error',message:e?.message||String(e)});
      } finally { if (!cancelled) setLoadingModels(false); }
    }, 1000);
    return () => {cancelled=true;clearTimeout(timer);controller.abort();};
  }, [apiKey]);

  async function handleLoadModels(): Promise<string | null> {
    if (detectApiProvider(apiKey) !== 'gemini') return null;
    setLoadingModels(true);
    setKeyStatus({ state: 'testing', message: 'Loading available Gemini models…' });
    try {
      const fetched = await listGeminiModels(apiKey);
      setModels(fetched);
      const selected =
        fetched.some((m) => m.id === geminiModel) ? geminiModel : fetched[0].id;
      preference('geminiModel', selected);
      setKeyStatus({
        state: 'ok',
        message: `Gemini key verified · ${selected}. No generation request was made.`,
      });
      return selected;
    } catch (e: any) {
      setModels([]);
      setKeyStatus({
        state: 'error',
        message: e?.message || String(e),
      });
      return null;
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleTestKey() {
    await handleLoadModels();
  }

  function handleRemoveKey() {
    setApiKey('');
    setShowKey(false);
    setModels([]);
    setKeyStatus({ state: 'idle', message: '' });
  }

  const lesson = resource?.lesson;
  const commands =
    lesson && lesson.page === page
      ? visibleCommands(lesson.commands, lesson.index + (playing || progress > 0 ? 1 : 0))
      : [];

  function preference(key: string, value: string | boolean) {
    setLib((l) => ({ ...l, prefs: { ...l.prefs, [key]: value } }));
  }

  async function download() {
    try {
      const url = URL.createObjectURL(
        new Blob([await exportLibrary(lib)], { type: 'application/json' })
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'margin-backup.json';
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      setStatus(String(e));
      return false;
    }
  }

  function hideChat(){setChatOpen(false);setChatHidden(true);try{localStorage.setItem('margin-chat-hidden','1')}catch{}}
  function showChat(open=true){setChatHidden(false);setChatOpen(open);try{localStorage.setItem('margin-chat-hidden','0')}catch{}}

  function toggleAi() {
    const next = !ai;
    setAi(next);
    if (!next) {
      abort.current?.abort();
      setPlaying(false);
    }
  }

  const filteredResources = lib.resources.filter(
    (r) =>
      r.subject === subject &&
      (!folder || r.folder === folder) &&
      r.name.toLowerCase().includes(search.toLowerCase())
  );

  return translateTree(
    <div
      className={'app ' + (resource ? 'in-document' : 'in-library')}
      dir={lib.prefs.ui === 'Arabic' ? 'rtl' : 'ltr'}
    >
      {/* Library View */}
      {!resource && (
        <>
          <aside className={'sidebar ' + (mobileNav ? 'open' : '')}>
            <div className="sidebar-top">
              <a className="brand" href="#" onClick={() => setActive('')}>
                margin
              </a>
              <button
                className="mobile-close"
                aria-label="Close menu"
                onClick={() => setMobileNav(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="subject-title">
              <span>Subjects</span>
              <button
                aria-label="Create subject"
                onClick={() => {
                  const name = prompt('Subject name');
                  if (name) {
                    const id = crypto.randomUUID();
                    setLib((l) => ({
                      ...l,
                      subjects: [...l.subjects, { id, name, folders: [] }],
                    }));
                    setSubject(id);
                    setActive('');
                    setFolder('');
                    setMobileNav(false);
                  }
                }}
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="subject-list">
              {lib.subjects.map((s) => (
                <button
                  key={s.id}
                  className={'subject ' + (subject === s.id ? 'selected' : '')}
                  onClick={() => {
                    setSubject(s.id);
                    setActive('');
                    setFolder('');
                    setMobileNav(false);
                  }}
                >
                  <BookOpen size={15} />
                  <span className="subject-name">{s.name}</span>
                  <span className="count">
                    {lib.resources.filter((r) => r.subject === s.id).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="sidebar-bottom">
              <button className="sidebar-btn" onClick={() => setSettings(true)}>
                <Settings size={15} />
                <span>Settings & AI Key</span>
              </button>
            </div>
          </aside>

          {mobileNav && (
            <div className="sidebar-backdrop" onClick={() => setMobileNav(false)} />
          )}

          <main className="library-main">
            <div className="library-topbar">
              <div className="library-topbar-left">
                <button
                  className="mobile-menu-btn"
                  aria-label="Subjects"
                  onClick={() => setMobileNav(true)}
                >
                  <Menu size={20} />
                </button>
                <h1>{currentSubject?.name}</h1>
              </div>
              <div className="library-topbar-actions">
                <label className="search-input">
                  <Search size={15} />
                  <input
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <button className="btn-secondary" onClick={() => files.current?.click()}>
                  <Upload size={15} />
                  <span>Import</span>
                </button>
                <button className="btn-primary" onClick={note}>
                  <Plus size={15} />
                  <span>New note</span>
                </button>
              </div>
            </div>

            <div className="folder-bar">
              <div className="folder-tabs">
                <button
                  className={!folder ? 'active-tab' : ''}
                  onClick={() => setFolder('')}
                >
                  All ({lib.resources.filter((r) => r.subject === subject).length})
                </button>
                {currentSubject?.folders.map((f) => (
                  <button
                    className={folder === f ? 'active-tab' : ''}
                    key={f}
                    onClick={() => setFolder(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                className="icon-btn"
                aria-label="New folder"
                title="New folder"
                onClick={() => {
                  const f = prompt('Folder name');
                  if (f && !currentSubject.folders.includes(f)) {
                    setLib((l) => ({
                      ...l,
                      subjects: l.subjects.map((s) =>
                        s.id === subject ? { ...s, folders: [...s.folders, f] } : s
                      ),
                    }));
                  }
                }}
              >
                <Folder size={16} />
              </button>
            </div>

            <div className="doc-grid">
              {filteredResources.map((r) => (
                <div className="doc-card" key={r.id}>
                  <button className="doc-open" onClick={() => open(r)}>
                    <div className={'doc-thumb ' + (r.kind === 'note' ? 'note-thumb ' : '') + (r.pages.length > 1 ? 'notebook-thumb' : '')}>
                      {r.pages.length > 1 ? <span className="notebook-cover" aria-hidden="true"><span className="notebook-cover-label"><span/><span/><span/></span></span> : <FileText size={24} strokeWidth={1.5} />}
                      <span className="doc-badge">{r.kind.toUpperCase()}</span>
                    </div>
                    <div className="doc-meta">
                      <h3>{r.name}</h3>
                      <p>
                        {r.pages.length} {r.kind === 'pptx' ? 'slides' : 'pages'} ·{' '}
                        {new Date(r.updated).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                  <button
                    className="doc-delete"
                    aria-label={'Delete ' + r.name}
                    onClick={() => {
                      if (confirm('Delete this local document?')) {
                        setLib((l) => ({
                          ...l,
                          resources: l.resources.filter((v) => v.id !== r.id),
                        }));
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button className="doc-new" onClick={note}>
                <Plus size={22} strokeWidth={1.5} />
                <span>New notebook</span>
              </button>
            </div>
          </main>
        </>
      )}

      {/* Full-Screen Document Workspace */}
      {resource && (
        <div className={'workspace-shell ' + (fullscreen ? 'immersive ' : '') + (resource.kind==='note'||whiteboard?'notes-workspace':'')}>
          {/* Minimal Floating Top Bar (hidden in immersive mode) */}
          {!fullscreen && (
            <header className="doc-header">
              <div className="doc-header-left">
                <button
                  className="icon-btn"
                  aria-label="Back to library"
                  onClick={() => setActive('')}
                >
                  <ArrowLeft size={18} />
                </button>
                <span className="doc-title" title={resource.name}>
                  {resource.name}
                </span>
              </div>

              <div className="doc-header-center">
                <button
                  className="icon-btn"
                  aria-label="Previous page"
                  disabled={page === 0}
                  onClick={() => {
                    navigatePage(page - 1);
                    setPlaying(false);
                    setSelection('');
                  }}
                >
                  <ChevronLeft size={17} />
                </button>
                <span className="page-indicator">
                  {page + 1} / {resource.pages.length}
                </span>
                <button
                  className="icon-btn"
                  aria-label="Next page"
                  disabled={page === resource.pages.length - 1}
                  onClick={() => {
                    navigatePage(page + 1);
                    setPlaying(false);
                    setSelection('');
                  }}
                >
                  <ChevronRight size={17} />
                </button>

              </div>

              <div className="doc-header-right">
                <button className="chat-access-btn" aria-label="إظهار الشات" title="إظهار الشات" onClick={()=>showChat()}><Sparkles size={16}/><span>{chatHidden?'إظهار الشات':'الشات'}</span></button>
                {cloud.info&&<button className={'icloud-badge '+cloud.state} title="iCloud Drive backup" onClick={()=>setSettings(true)}>{cloud.state==='saving'?'iCloud · جارٍ الحفظ':cloud.state==='error'?'iCloud · تعذر الحفظ':cloud.state==='restore-first'?'iCloud · نسخة للاستعادة':cloud.state==='saved'&&cloud.enabled?'iCloud · محفوظ على الماك':cloud.enabled?'iCloud · تلقائي':'iCloud · متوقف'}</button>}
                <div className="zoom-group">
                  <button
                    className="icon-btn"
                    aria-label="Zoom out"
                    onClick={() => setZoom(Math.max(50, zoom - 15))}
                  >
                    <ZoomOut size={16} />
                  </button>
                  <button
                    className="zoom-reset"
                    title={fitPage?'تكبير الورقة':'إظهار الورقة كاملة'}
                    aria-label="تبديل حجم الورقة"
                    onClick={() => {setFitPage(v=>!v);setZoom(100)}}
                  >
                    {zoom}%
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Zoom in"
                    onClick={() => setZoom(Math.min(250, zoom + 15))}
                  >
                    <ZoomIn size={16} />
                  </button>
                </div>

                <button
                  className={'icon-btn ' + (whiteboard ? 'active' : '')}
                  aria-label="Whiteboard"
                  title="Whiteboard"
                  onClick={() => setWhiteboard(!whiteboard)}
                >
                  <SquarePen size={17} />
                </button>

                <button
                  className="icon-btn"
                  aria-label="Full screen"
                  title="Full screen study mode"
                  onClick={() => setFullscreen(true)}
                >
                  <Maximize2 size={16} />
                </button>

                <button
                  className="icon-btn"
                  aria-label="Settings"
                  title="Settings"
                  onClick={() => setSettings(true)}
                >
                  <Settings size={17} />
                </button>
              </div>
            </header>
          )}

          {/* Immersive exit pill */}
          {fullscreen && (
            <button
              className="exit-immersive"
              aria-label="Exit full screen"
              onClick={() => setFullscreen(false)}
            >
              <Minimize2 size={15} />
            </button>
          )}

          {/* Full-screen paper area */}
          <div className="paper-scroll book-scroll" ref={scrollRef} onPointerDownCapture={()=>setEraserMenu(false)}
            onTouchStart={e=>{const t=e.touches[0] as Touch & {touchType?:string};swipeStart.current=e.touches.length===1&&t.touchType!=='stylus'&&tool!=='select'&&tool!=='text'?{x:t.clientX,y:t.clientY,time:Date.now()}:null;}}
            onTouchMove={e=>{if(e.touches.length!==1)swipeStart.current=null;}}
            onTouchCancel={()=>{swipeStart.current=null;}}
            onTouchEnd={e=>{const start=swipeStart.current;swipeStart.current=null;if(!start||e.touches.length)return;const t=e.changedTouches[0];if(!t)return;const delta=pageTurnGesture(start,{x:t.clientX,y:t.clientY,time:Date.now()},zoom);const next=page+delta;if(delta&&next>=0&&next<resource.pages.length)navigatePage(next);}}>

            <div
              className={'paper-stage book-stage '+(curlDriver?'is-hand-folding ':'')+(zoomGesture?'is-pinching':'')}
              style={{
                ...({'--page-zoom':zoom/100} as React.CSSProperties),
                width: zoom === 100 ? '100%' : zoom + '%',
                maxWidth: fitPage?`min(${860*zoom/100}px, max(180px, calc((100dvh - 240px) * ${(resource.pages[page].ratio||0.74)*zoom/100})))`:(860*zoom/100)+'px',
              }}
            >
              <button className="book-edge book-prev" aria-label="الورقة السابقة" title="الورقة السابقة" disabled={page===0} onClick={()=>navigatePage(page-1)}><ChevronLeft size={24}/></button>
              <button className="book-edge book-next" aria-label="الورقة التالية" title="الورقة التالية" disabled={page===resource.pages.length-1} onClick={()=>navigatePage(page+1)}><ChevronRight size={24}/></button>
              {viewPages.map((sheet,index)=>({sheet,index})).filter(({index})=>Math.abs(index-page)<=1).map(({sheet,index}) => {return (
                <NotebookPage key={resource.id+':'+index+':'+whiteboard} index={index} active={(dragTarget??page)===index} hidden={(dragTarget??page)!==index} preload ratio={sheet.ratio||0.74} onActivate={()=>{if(page!==index){setPage(index);setPlaying(false);setSelection('')}}}>
                  <div className="paper-leaf-frame"><Board
                    resource={whiteboard?{...resource,kind:'note',pages:viewPages.map(p=>({...p,text:'',image:undefined}))}:pendingBlank?{...resource,pages:viewPages}:resource}
                    page={index}
                    tool={tool}
                    color={color}
                    eraserMode={lib.prefs.eraserMode||'pixel'}
                    onPage={next=>updatePage(next,index)}
                    commands={resource.lesson?.page===index?visibleCommands(resource.lesson.commands,resource.lesson.index+(playing||progress>0?1:0)):[]}
                    progress={playing||progress>0?progress:1}
                    onSelection={setSelection}
                  />
                  </div>
                </NotebookPage>
              )})}
              <div className="book-grab-handles" style={{aspectRatio:resource.pages[page].ratio||0.74}}>
                {(page<resource.pages.length-1||resource.kind==='note')&&<button className={'paper-corner paper-corner-next '+(page===resource.pages.length-1?'paper-corner-add':'')} aria-label={page===resource.pages.length-1?'اطو الزاوية لإضافة ورقة جديدة':'اسحب زاوية الورقة التالية'} title={page===resource.pages.length-1?'اسحب الطيّة لإضافة ورقة':'امسك الزاوية واسحبها'} onPointerDown={e=>beginFold(e,1)} onPointerMove={moveFold} onPointerUp={e=>finishFoldInput(e)} onPointerCancel={e=>finishFoldInput(e,true)} onLostPointerCapture={e=>finishFoldInput(e,true)} onTouchStart={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onClick={e=>{if(e.detail===0){if(page===resource.pages.length-1)addPageFromCorner();else navigatePage(page+1)}}}>{page===resource.pages.length-1&&<Plus size={15}/>}</button>}
                {page>0&&<button className="paper-corner paper-corner-prev" aria-label="اسحب زاوية الورقة السابقة" title="امسك الزاوية واسحبها" onPointerDown={e=>beginFold(e,-1)} onPointerMove={moveFold} onPointerUp={e=>finishFoldInput(e)} onPointerCancel={e=>finishFoldInput(e,true)} onLostPointerCapture={e=>finishFoldInput(e,true)} onTouchStart={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onClick={e=>{if(e.detail===0)navigatePage(page-1)}}/>}
              </div>
              {curl&&<PaperCurl key={curl.key} snapshot={curl} driver={curlDriver} onDone={finishFold}/>}
              <div className="book-navigation"><button disabled={page===0} onClick={()=>navigatePage(page-1)}><ChevronLeft size={16}/> السابقة</button><span>الصفحة {page+1} من {resource.pages.length}</span><button disabled={page===resource.pages.length-1} onClick={()=>navigatePage(page+1)}>التالية <ChevronRight size={16}/></button></div>


            </div>
          </div>

          {/* Floating Drawing Toolbar */}
          {fullscreen?<div className="floating-toolbar compact-tools" role="toolbar" aria-label="القلم والممحاة">
            <button className="tool-btn" aria-label={tool==='eraser'?'استخدام القلم':'استخدام الممحاة'} title="اضغط للتبديل، أو اضغط مطولًا لاختيار نوع الممحاة" onPointerDown={()=>{heldTool.current=false;eraserHold.current=setTimeout(()=>{heldTool.current=true;setEraserMenu(true)},450)}} onPointerUp={()=>{if(eraserHold.current)clearTimeout(eraserHold.current)}} onPointerCancel={()=>{if(eraserHold.current)clearTimeout(eraserHold.current)}} onPointerLeave={()=>{if(eraserHold.current)clearTimeout(eraserHold.current)}} onContextMenu={e=>{e.preventDefault();setEraserMenu(v=>!v)}} onClick={()=>{if(heldTool.current){heldTool.current=false;return}setTool(tool==='eraser'?'pen':'eraser');setEraserMenu(false)}}>{tool==='eraser'?<PenLine size={22}/>:<Eraser size={22}/>}</button>
          </div>:(<div className="floating-toolbar" role="toolbar" aria-label="Drawing tools">
            {[
              ['pen', PenLine, 'Pen'],
              ['eraser', Eraser, 'Eraser'],
              ['text', Type, 'Text'],
              ['select', FileText, 'Select text'],
              ['region', MousePointer2, 'Select region'],
            ].map(([t, Icon, label]: any) => (
              <button
                key={t}
                aria-label={label}
                title={label}
                className={'tool-btn ' + (tool === t ? 'active' : '')}
                onClick={() => {if(t==='eraser'){setTool(t);setEraserMenu(v=>!v)}else{setTool(t);setEraserMenu(false)}}}
              >
                <Icon size={17} />
              </button>
            ))}

            <span className="toolbar-divider" />

            <div className="color-dots">
              {INK_COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={'Color ' + c}
                  className={'color-dot ' + (color === c ? 'active' : '')}
                  style={{ background: c }}
                  onClick={() => {
                    setColor(c);
                    setTool('pen');
                  }}
                />
              ))}
            </div>

            <span className="toolbar-divider" />

            <button
              className="tool-btn"
              aria-label="Undo"
              title="Undo"
              onClick={() =>
                updatePage({
                  ...resource.pages[page],
                  strokes: resource.pages[page].strokes.slice(0, -1),
                })
              }
            >
              <Undo2 size={17} />
            </button>
          </div>)}
          {eraserMenu&&<div className="eraser-options" role="group" aria-label="نوع الممحاة"><button className={(lib.prefs.eraserMode||'pixel')==='pixel'?'selected':''} onClick={()=>{preference('eraserMode','pixel');setTool('eraser');setEraserMenu(false)}}><Eraser size={17}/><span>عادية<small>تمسح الجزء الذي تمر عليه</small></span></button><button className={lib.prefs.eraserMode==='stroke'?'selected':''} onClick={()=>{preference('eraserMode','stroke');setTool('eraser');setEraserMenu(false)}}><PenLine size={17}/><span>خط كامل<small>تمسح ضربة القلم كاملة</small></span></button></div>}

          {/* Floating Lesson Playback Bar (only when an AI lesson is active) */}
          {lesson && (
            <div className="floating-playback">
              <button
                className="icon-btn"
                aria-label="Previous step"
                onClick={() => {
                  setPlaying(false);
                  updateResource((r) => ({
                    ...r,
                    lesson: { ...lesson, index: Math.max(0, lesson.index - 1) },
                  }));
                }}
              >
                <SkipBack size={15} />
              </button>
              <button className="pill-btn" onClick={() => setPlaying(!playing)}>
                {playing ? <Pause size={14} /> : <Play size={14} />}
                <span>{playing ? 'Pause' : 'Resume'}</span>
              </button>
              <span className="playback-step">
                {lesson.index}/{lesson.commands.length}
              </span>
              <select
                aria-label="Speed"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value="0.5">0.5×</option>
                <option value="1">1×</option>
                <option value="2">2×</option>
                <option value="4">4×</option>
              </select>
              <button
                className="pill-btn"
                onClick={() => {
                  updatePage({
                    ...resource.pages[page],
                    commands: [...resource.pages[page].commands, ...commands],
                  });
                  updateResource((r) => ({ ...r, lesson: undefined }));
                  setPlaying(false);
                }}
              >
                Keep ink
              </button>
              <button
                className="icon-btn"
                aria-label="Clear AI lesson"
                onClick={() => {
                  updateResource((r) => ({ ...r, lesson: undefined }));
                  setPlaying(false);
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}

          {!chatOpen&&!chatHidden&&<FloatingChatButton active={ai} onOpen={()=>showChat()} onHide={hideChat}/>}

          {/* Compact / Expandable Floating AI Panel (never resizes the document) */}
          {chatOpen && (
            <aside className={'floating-ai-panel ' + (chatExpanded ? 'expanded' : '')}>
              <div className="ai-panel-header">
                <div className="ai-panel-title">
                  <Sparkles size={15} />
                  <span>AI Assistant</span>
                </div>
                <div className="ai-panel-actions">
                  <button className="icon-btn" aria-label="إخفاء الشات بالكامل" title="إخفاء الشات بالكامل" onClick={hideChat}><EyeOff size={15}/></button>
                  <button
                    className={'ai-switch ' + (ai ? 'on' : '')}
                    onClick={toggleAi}
                  >
                    AI {ai ? 'ON' : 'OFF'}
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={chatExpanded ? 'Compact panel' : 'Expand panel'}
                    onClick={() => setChatExpanded(!chatExpanded)}
                  >
                    {chatExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Close AI panel"
                    onClick={() => setChatOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="mode-tabs">
                {['Explain', 'Solve Together', 'Practice'].map((m) => (
                  <button
                    className={mode === m ? 'chosen' : ''}
                    key={m}
                    onClick={() => setMode(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div
                className="ai-messages"
                dir={lib.prefs.conversation === 'Arabic' ? 'rtl' : 'ltr'}
              >
                {!resource.chat.length && (
                  <div className="ai-empty">
                    <p>
                      {ai
                        ? 'Ask about this page, select a region, or work through a problem.'
                        : 'Turn AI ON when you want help. No background analysis.'}
                    </p>
                    {!apiKey && (
                      <button
                        className="link-btn"
                        onClick={() => setSettings(true)}
                      >
                        <KeyRound size={13} />
                        <span>Add Gemini API key</span>
                      </button>
                    )}
                    <small>Context: {currentSubject?.name} only</small>
                  </div>
                )}

                {resource.chat.map((m, i) => (
                  <div key={i} className={'ai-msg ' + m.role}>
                    <p>{m.text}</p>
                  </div>
                ))}
                {busy && <p className="ai-thinking">Thinking…</p>}
              </div>

              {selection && (
                <div className="ai-selection">
                  <span>{selection}</span>
                  <button onClick={() => setSelection('')}>
                    <X size={13} />
                  </button>
                </div>
              )}

              {selectionRect(selection) && <button type="button" className="btn-secondary btn-sm" onClick={()=>{setPinnedAnswerArea(selectionRect(selection));setSelection('');setStatus('تم تثبيت مساحة الحل. حدد السؤال الآن أو اكتبه في المحادثة.');}}>اكتب الحل هنا (المساحة المحددة)</button>}
              {pinnedAnswerArea && <div className="ai-selection"><span>مساحة الحل مثبتة في هذه الصفحة</span><button type="button" onClick={()=>setPinnedAnswerArea(undefined)}>إلغاء</button></div>}
              <div className="quick-prompts">
                <button
                  disabled={!ai || busy}
                  onClick={() =>
                    ask('Why was the current step performed? Explain the reasoning.')
                  }
                >
                  Why this step?
                </button>
                <button
                  disabled={!ai || busy}
                  onClick={() =>
                    ask('Explain the current concept another way, using only my resources.')
                  }
                >
                  Explain another way
                </button>
              </div>

              <form
                className="ai-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  ask();
                }}
              >
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      ask();
                    }
                  }}
                  placeholder={
                    !ai
                      ? 'Turn AI ON to ask…'
                      : mode === 'Practice'
                        ? 'Ask for a review of your written work…'
                        : 'Ask about this page…'
                  }
                  aria-label="Message AI assistant"
                  rows={2}
                />
                <label style={{display:'flex',gap:8,fontSize:12,alignItems:'center',padding:'8px 0'}}><input type="checkbox" checked={attachPage} onChange={e=>setAttachPage(e.target.checked)}/> إرفاق صورة الصفحة (استهلاك أعلى؛ تلقائي لمراجعة الحل والصور)</label>
                <div className="ai-form-footer">
                  <small>{ai ? 'Economy mode · limited context' : 'AI is off'}</small>
                  <button
                    className="btn-primary btn-sm"
                    disabled={!ai || busy || !query.trim()}
                    type="submit"
                  >
                    {busy ? 'Working…' : 'Ask'}
                  </button>
                </div>
              </form>
            </aside>
          )}
        </div>
      )}

      {/* Toast Notification */}
      {status && (
        <div className="toast" role="status">
          <span>{status}</span>
          <button aria-label="Dismiss notification" onClick={() => setStatus('')}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        hidden
        ref={files}
        type="file"
        multiple
        accept=".pdf,.pptx,.png,.jpg,.jpeg"
        onChange={(e) => {
          importFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        hidden
        ref={backup}
        type="file"
        accept=".json"
        onChange={async (e) => {
          try {
            const f = e.target.files?.[0];
            if (f && confirm('Replace the local library with this backup?')) {
              const d = importLibrary(await f.text());
              setLib(d);
              setSubject(d.subjects[0].id);
              setActive('');
              setStatus('Backup restored.');
            }
          } catch (err) {
            setStatus(String(err));
          }
          e.target.value = '';
        }}
      />

      {/* Settings & BYOK Gemini API Key Modal */}
      {settings && (
        <div className="modal-backdrop" onClick={() => setSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Settings</h2>
              <button
                className="icon-btn"
                aria-label="Close settings"
                onClick={() => setSettings(false)}
              >
                <X size={18} />
              </button>
            </div>

            <section className="settings-section">
              <h3>API key · automatic Gemini detection</h3>
              <p className="settings-note">
                Enter your personal Gemini API key to use the AI assistant directly over
                HTTPS. Paste the key; Gemini and an economical model are detected automatically. Other providers are not contacted. Your key is kept in memory for this session only and is never saved
                to browser storage, logs, URLs, or backups.
              </p>

              <a
                className="api-key-link"
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Get a free Gemini API key at Google AI Studio</span>
                <ExternalLink size={13} />
              </a>

              <label className="field">
                <span>Personal Gemini API Key</span>
                <div className="key-input-row">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      if (keyStatus.state !== 'idle') {
                        setKeyStatus({ state: 'idle', message: '' });
                      }
                    }}
                    placeholder="AIza…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label className="field">
                <span>Available Model (from Gemini API)</span>
                <select
                  value={geminiModel}
                  disabled={!models.length}
                  onChange={(e) => {
                    preference('geminiModel', e.target.value);
                    if (keyStatus.state !== 'idle') {
                      setKeyStatus({ state: 'idle', message: '' });
                    }
                  }}
                >
                  {!models.length ? (
                    <option value="">
                      {apiKey.trim()
                        ? 'Detecting provider and models automatically…'
                        : 'Enter your API key first'}
                    </option>
                  ) : (
                    models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName} ({m.id})
                      </option>
                    ))
                  )}
                </select>
              </label>

              {billingBlocked && <div role="alert" className="key-status error"><p>توقفت طلبات الذكاء الاصطناعي لأن Google أعادت HTTP 402: رصيد الدفع المسبق غير متاح. تغيير النموذج لا يحل مشكلة رصيد الحساب. راجع المشروع في AI Studio أو استخدم مشروع Free Tier مؤهلًا.</p><button type="button" className="btn-secondary" onClick={()=>{resumeGeminiRequests(apiKey);setBillingBlocked(false);setStatus('Retry allowed. Enable AI and ask once after resolving billing.');}}>حللت مشكلة الفوترة — السماح بمحاولة جديدة</button></div>}
              <div className="key-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!apiKey.trim() || loadingModels || keyStatus.state === 'testing'}
                  onClick={handleLoadModels}
                >
                  {loadingModels ? 'Loading…' : 'Load models'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!apiKey.trim() || loadingModels || keyStatus.state === 'testing'}
                  onClick={handleTestKey}
                >
                  {keyStatus.state === 'testing' ? 'Checking…' : 'Check key (no generation)'}
                </button>
                {apiKey && (
                  <button
                    type="button"
                    className="btn-ghost danger"
                    onClick={handleRemoveKey}
                  >
                    Remove key
                  </button>
                )}
              </div>

              {keyStatus.state !== 'idle' && (
                <div className={'key-status ' + keyStatus.state}>
                  {keyStatus.state === 'ok' && <CheckCircle2 size={15} />}
                  {keyStatus.state === 'error' && <AlertCircle size={15} />}
                  <span>{keyStatus.message}</span>
                </div>
              )}

              <p className="security-notice">
                Security notice: Browser-based API keys are not fully secure and are
                intended for private testing only. Do not share your screen or use this on
                shared/public devices.
              </p>
            </section>

            <section className="settings-section">
              <h3>Languages</h3>
              <div className="lang-grid">
                {(['ui', 'conversation', 'explanation', 'writing'] as const).map((k) => (
                  <label className="field" key={k}>
                    <span>
                      {k === 'ui'
                        ? 'Interface'
                        : k[0].toUpperCase() + k.slice(1)}
                    </span>
                    <select
                      value={lib.prefs[k] || 'English'}
                      onChange={(e) => preference(k, e.target.value)}
                    >
                      <option>English</option>
                      <option>Arabic</option>
                    </select>
                  </label>
                ))}
              </div>
            </section>

            <section className="settings-section icloud-settings" dir="rtl">
              <h3>iCloud Drive — الحفظ التلقائي</h3>
              <p className="settings-note">نسخة احتياطية للدفاتر والملفات والكتابة والمحادثات في مجلد iCloud Drive على هذا الماك. مفتاح Gemini لا يدخل في النسخة. تعمل أثناء تشغيل الخادم المحلي؛ رفع الملف لأجهزة Apple الأخرى تتولاه مزامنة iCloud.</p>
              <label className="icloud-switch"><input type="checkbox" checked={cloud.enabled} disabled={!cloud.info} onChange={e=>preference('icloudBackup',e.target.checked)}/> حفظ تلقائي بعد التعديلات</label>
              <div className={'icloud-status '+cloud.state} role="status">{cloud.state==='checking'?'جارٍ فحص iCloud Drive…':cloud.state==='unavailable'?'iCloud Drive غير متاح للنسخة المحلية حاليًا':cloud.state==='restore-first'?'توجد نسخة iCloud أحدث أو أن المكتبة المحلية فارغة. استعد النسخة قبل المتابعة لتجنب استبدالها.':cloud.state==='saving'?'جارٍ الكتابة إلى مجلد iCloud Drive…':cloud.state==='error'?'تعذر النسخ الاحتياطي. الملاحظات ما زالت محفوظة محليًا.':cloud.state==='saved'?'حُفظت النسخة في مجلد iCloud Drive على الماك':cloud.enabled?'الحفظ التلقائي جاهز':'الحفظ التلقائي متوقف'}</div>
              {cloud.info?.savedAt&&<p className="settings-note">آخر ملف محفوظ: {new Date(cloud.info.savedAt).toLocaleString()}<br/>{cloud.info.folder}</p>}
              {cloud.error&&<p className="icloud-error">{cloud.error}</p>}
              <div className="backup-actions">
                <button className="btn-secondary" disabled={!cloud.info||!cloud.enabled||cloud.state==='saving'||cloud.state==='restore-first'} onClick={()=>void cloud.saveNow()}>حفظ الآن</button>
                <button className="btn-secondary" disabled={!cloud.info?.hasBackup||cloud.state==='saving'} onClick={async()=>{if(!confirm('استبدال المكتبة المحلية بنسخة iCloud؟ سيتم تنزيل نسخة من المكتبة الحالية أولًا.'))return;try{if(!await download())return;await cloud.restore();setStatus('تمت استعادة نسخة iCloud.')}catch(e){setStatus(String(e))}}}>استعادة من iCloud</button>
                {cloud.info?.hasPrevious&&<button className="btn-secondary" disabled={cloud.state==='saving'} onClick={async()=>{if(!confirm('استعادة النسخة السابقة من iCloud؟ سيتم تنزيل نسخة محلية أولًا.'))return;try{if(!await download())return;await cloud.restore(true);setStatus('تمت استعادة النسخة السابقة.')}catch(e){setStatus(String(e))}}}>النسخة السابقة</button>}
              </div>
            </section>

            <section className="settings-section">
              <h3>Local Backup</h3>
              <div className="backup-actions">
                <button className="btn-secondary" onClick={download}>
                  <Download size={15} />
                  <span>Export backup</span>
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => backup.current?.click()}
                >
                  <Upload size={15} />
                  <span>Restore backup</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>,
    lib.prefs.ui === 'Arabic'
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
