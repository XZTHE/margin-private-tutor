import {useEffect,useRef,useState} from 'react';
import {type Library} from './core';
import {serializeICloudBackup} from './icloud';
import {cloudKitContainer,fetchCloudRecord,readCloudLibrary,saveCloudLibrary,type CloudDatabase,type CloudRecord} from './cloudkit';
export function useCloudSync(library:Library,onRestore:(data:Library)=>void){
  const [state,setState]=useState<'off'|'connecting'|'sign-in'|'syncing'|'synced'|'conflict'|'error'>('off');
  const [error,setError]=useState('');
  const current=useRef(library);current.current=library;
  const apply=useRef(onRestore);apply.current=onRestore;
  const db=useRef<CloudDatabase|null>(null),record=useRef<CloudRecord|null>(null);
  const baseline=useRef<string|null>(null),busy=useRef(false),generation=useRef(0);
  const connected=useRef(false);
  async function sync(){
    if(!db.current||busy.current||!connected.current)return;
    busy.current=true;const epoch=generation.current;setState('syncing');
    try{
      const snapshot=current.current,raw=await serializeICloudBackup(snapshot);
      const remote=await fetchCloudRecord(db.current);
      if(epoch!==generation.current)return;
      if(baseline.current===null){
        if(remote){
          const data=await readCloudLibrary(remote);
          if(epoch!==generation.current)return;
          const remoteRaw=await serializeICloudBackup(data);
          if(current.current!==snapshot){record.current=remote;setState('conflict');return;}
          if(raw!==remoteRaw&&snapshot.resources.length){record.current=remote;setState('conflict');return;}
          record.current=remote;baseline.current=remoteRaw;current.current=data;apply.current(data);
        }else{
          // Only upload after confirming this user's private database has no saved library.
          record.current=await saveCloudLibrary(db.current,snapshot,null);baseline.current=raw;
        }
      }else if(remote?.recordChangeTag!==record.current?.recordChangeTag){
        if(raw!==baseline.current){record.current=remote;setState('conflict');return;}
        if(!remote){record.current=null;setState('conflict');return;}
        const data=await readCloudLibrary(remote);
        if(epoch!==generation.current)return;
        if(current.current!==snapshot){record.current=remote;setState('conflict');return;}
        record.current=remote;baseline.current=await serializeICloudBackup(data);current.current=data;apply.current(data);
      }else if(raw!==baseline.current){record.current=await saveCloudLibrary(db.current,snapshot,record.current);baseline.current=raw;}
      if(epoch===generation.current){setError('');setState('synced');}
    }catch(e){if(epoch===generation.current){setError(e instanceof Error?e.message:String(e));setState('error');}}
    finally{busy.current=false;}
  }
  async function connect(){
    if(busy.current)return;
    setState('connecting');setError('');const epoch=++generation.current;
    try{
      const container=await cloudKitContainer();
      const identity=await container.setUpAuth();
      if(epoch!==generation.current)return;
      const signedIn=async()=>{if(epoch!==generation.current)return;db.current=container.privateCloudDatabase;connected.current=true;baseline.current=null;record.current=null;await sync();};
      if(identity)await signedIn();else{setState('sign-in');void container.whenUserSignsIn().then(signedIn).catch(e=>{setError(String(e));setState('error')});}
      void container.whenUserSignsOut().then(()=>{if(epoch!==generation.current)return;connected.current=false;db.current=null;baseline.current=null;record.current=null;generation.current++;setState('off')});
    }catch(e){setError(e instanceof Error?e.message:String(e));setState('error');}
  }
  async function useCloud(){
    if(!db.current||busy.current)return;
    busy.current=true;setState('syncing');
    try{const remote=await fetchCloudRecord(db.current);if(!remote)throw Error('لا توجد نسخة سحابية');const data=await readCloudLibrary(remote);record.current=remote;baseline.current=await serializeICloudBackup(data);current.current=data;apply.current(data);setError('');setState('synced');}
    catch(e){setError(String(e));setState('error')}finally{busy.current=false}
  }
  useEffect(()=>{if(state!=='synced')return;const timer=setTimeout(()=>{void serializeICloudBackup(current.current).then(raw=>{if(raw!==baseline.current)void sync()}).catch(e=>{setError(String(e));setState('error')})},3000);return()=>clearTimeout(timer)},[library,state]);
  useEffect(()=>{const timer=setInterval(()=>{if(connected.current&&document.visibilityState==='visible'&&state!=='conflict')void sync()},30000);const focus=()=>{if(state!=='conflict')void sync()};window.addEventListener('focus',focus);return()=>{clearInterval(timer);window.removeEventListener('focus',focus)}},[state]);
  useEffect(()=>()=>{generation.current++;connected.current=false},[]);
  return {state,error,connect,sync,useCloud};
}
