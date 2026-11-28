import {importLibrary,type Library} from './core';
import {serializeICloudBackup} from './icloud';
export interface CloudRecord {recordName:string;recordType?:string;recordChangeTag?:string;fields:Record<string,{value:unknown}>}
interface Response {hasErrors?:boolean;errors?:{ckErrorCode?:string;reason?:string}[];records:CloudRecord[]}
export interface CloudDatabase {fetchRecords(name:string):Promise<Response>;saveRecords(record:CloudRecord):Promise<Response>}
interface Container {privateCloudDatabase:CloudDatabase;setUpAuth():Promise<unknown>;whenUserSignsIn():Promise<unknown>;whenUserSignsOut():Promise<unknown>}
interface SDK {configure(config:unknown):void;getDefaultContainer():Container}
declare global {interface Window {CloudKit?:SDK}}
let loading:Promise<SDK>|undefined;
export function loadCloudKit(){
  if(window.CloudKit)return Promise.resolve(window.CloudKit);
  return loading??=new Promise<SDK>((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://cdn.apple-cloudkit.com/ck/2/cloudkit.js';script.async=true;
    script.onload=()=>window.CloudKit?resolve(window.CloudKit):reject(Error('تعذر تحميل CloudKit'));
    script.onerror=()=>{loading=undefined;script.remove();reject(Error('تعذر الاتصال بخدمة Apple'))};document.head.append(script);
  });
}
export const cloudKitConfigured=!!(import.meta.env.VITE_CLOUDKIT_CONTAINER&&import.meta.env.VITE_CLOUDKIT_API_TOKEN);
export async function cloudKitContainer(){
  if(!cloudKitConfigured)throw Error('يلزم إعداد Container ID وWeb API Token من CloudKit');
  const sdk=await loadCloudKit();
  sdk.configure({containers:[{containerIdentifier:import.meta.env.VITE_CLOUDKIT_CONTAINER,environment:import.meta.env.VITE_CLOUDKIT_ENVIRONMENT||'development',apiTokenAuth:{apiToken:import.meta.env.VITE_CLOUDKIT_API_TOKEN,persist:true,signInButton:{id:'margin-apple-sign-in'},signOutButton:{id:'margin-apple-sign-out'}}}]});
  return sdk.getDefaultContainer();
}
const name='margin-library-v1';
function checked(response:Response){if(response.hasErrors)throw Error(response.errors?.map(e=>e.reason||e.ckErrorCode).join('، ')||'CloudKit error');return response.records[0];}
export async function fetchCloudRecord(db:CloudDatabase){
  const response=await db.fetchRecords(name);
  if(response.hasErrors&&response.errors?.length===1&&response.errors[0].ckErrorCode==='UNKNOWN_ITEM')return null;
  return checked(response)||null;
}
export async function readCloudLibrary(record:CloudRecord):Promise<Library>{
  const asset=record.fields.backup?.value as {downloadURL?:string}|undefined;
  if(!asset?.downloadURL)throw Error('نسخة CloudKit لا تحتوي على ملف الدفاتر');
  const url=new URL(asset.downloadURL.replace('${f}','library.json'));
  if(url.protocol!=='https:')throw Error('رابط نسخة CloudKit غير صالح');
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw Error('تعذر تنزيل دفاتر iCloud');
  return importLibrary(await response.text());
}
export async function saveCloudLibrary(db:CloudDatabase,library:Library,previous:CloudRecord|null){
  const raw=await serializeICloudBackup(library);
  return checked(await db.saveRecords({recordName:name,recordType:'MarginLibrary',...(previous?.recordChangeTag?{recordChangeTag:previous.recordChangeTag}:{}),fields:{backup:{value:new Blob([raw],{type:'application/json'})}}}));
}
