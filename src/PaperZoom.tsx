import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';

// Keep layout at its natural size. Zoom the complete sheet with one uniform transform.
export function PaperZoom({zoom,pinching,immersive,fit,ratio,children}:{zoom:number;pinching:boolean;immersive:boolean;fit:boolean;ratio:number;children:ReactNode}){
  const frame=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null);
  const [size,setSize]=useState({width:860,height:1162});
  useLayoutEffect(()=>{
    const viewport=frame.current?.parentElement,inner=content.current;
    if(!viewport||!inner)return;
    const measure=()=>{
      const css=getComputedStyle(viewport);
      const available=viewport.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);
      const width=Math.max(1,Math.min(available,immersive?Infinity:fit?Math.min(860,Math.max(180,(window.innerHeight-240)*ratio)):860));
      inner.style.width=width+'px';
      const height=inner.offsetHeight;
      setSize(old=>old.width===width&&old.height===height?old:{width,height});
    };
    const observer=new ResizeObserver(measure);
    observer.observe(viewport);observer.observe(inner);
    window.addEventListener('resize',measure);measure();
    return()=>{observer.disconnect();window.removeEventListener('resize',measure)};
  },[immersive,fit,ratio]);
  const scale=zoom/100;
  return <div ref={frame} className={'paper-zoom-frame'+(pinching?' is-pinching':'')} style={{width:size.width*scale,height:size.height*scale}}>
    <div ref={content} className="paper-zoom-content" style={{width:size.width,transform:`scale(${scale})`}}>{children}</div>
  </div>;
}
