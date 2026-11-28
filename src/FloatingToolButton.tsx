import {useEffect,useRef} from 'react';
import {ChevronDown,Eraser,PenLine,Sparkles} from 'lucide-react';
const bound=(p:{x:number;y:number})=>({x:Math.max(10,Math.min(innerWidth-112,p.x)),y:Math.max(10,Math.min(innerHeight-66,p.y))});
export function FloatingToolButton({tool,menuOpen,chatOpen,onToggle,onOptions,onAI}:{tool:string;menuOpen:boolean;chatOpen:boolean;onToggle:()=>void;onOptions:()=>void;onAI:()=>void}){
  const root=useRef<HTMLDivElement>(null);
  const position=useRef({x:0,y:0});
  const drag=useRef<{id:number;x:number;y:number;left:number;top:number;moved:boolean}|null>(null);
  const suppressClick=useRef(false);
  const frame=useRef(0);
  function paint(p=position.current){if(root.current)root.current.style.transform=`translate3d(${p.x}px,${p.y}px,0)`;}
  useEffect(()=>{
    let saved;try{saved=JSON.parse(localStorage.getItem('margin-tool-position')||'null')}catch{}
    position.current=bound(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)?saved:{x:innerWidth/2-51,y:innerHeight-78});paint();
    const resize=()=>{position.current=bound(position.current);paint()};
    window.addEventListener('resize',resize);
    return()=>{window.removeEventListener('resize',resize);cancelAnimationFrame(frame.current)};
  },[]);
  function finish(e:React.PointerEvent<HTMLButtonElement>){
    const d=drag.current;if(!d||d.id!==e.pointerId)return;
    drag.current=null;suppressClick.current=d.moved;
    cancelAnimationFrame(frame.current);frame.current=0;
    position.current=bound(position.current);
    root.current?.classList.remove('is-dragging');paint();
    try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}
    try{localStorage.setItem('margin-tool-position',JSON.stringify(position.current))}catch{}
  }
  return <div ref={root} className="floating-toolbar compact-tools movable-tool-orb" role="toolbar" aria-label="القلم والممحاة والذكاء الاصطناعي">
    <button className="tool-btn" aria-label={tool==='eraser'?'الممحاة مفعلة، اضغط لاستخدام القلم أو اسحب للتحريك':'القلم مفعل، اضغط لاستخدام الممحاة أو اسحب للتحريك'}
      onPointerDown={e=>{if(!e.isPrimary||e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();suppressClick.current=false;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:position.current.x,top:position.current.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId);root.current?.classList.add('is-dragging')}}
      onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>6)d.moved=true;if(!d.moved)return;const raw={x:d.left+dx,y:d.top+dy},edge=bound(raw);position.current={x:edge.x+(raw.x-edge.x)*.18,y:edge.y+(raw.y-edge.y)*.18};if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;paint()})}}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
      onClick={e=>{if(suppressClick.current&&e.detail!==0){suppressClick.current=false;return}onToggle()}}>{tool==='eraser'?<Eraser size={22}/>:<PenLine size={22}/>}</button>
    <button className="tool-orb-ai" aria-label="فتح المعلم الذكي" aria-expanded={chatOpen} onClick={onAI}><Sparkles size={18}/></button>
    <button className="tool-options-arrow" aria-label="خيارات الأداة" aria-expanded={menuOpen} onClick={onOptions}><ChevronDown size={13}/></button>
  </div>;
}
