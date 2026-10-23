import { collection, doc, onSnapshot, orderBy, query, limit, setDoc, where } from 'firebase/firestore';
import { getFirestoreDb } from './firebase';

export type ProductionImportRecord={
  id:string; branch:string; periodStart:string; periodEnd:string; workdays:number;
  filename:string; importedAt:string; importedBy:string;
  rows:Array<{employee:string;pulled:number;checked:number;putaway:number;workedHours:number}>;
};
export function subscribeProductionImports(branch:string,onUpdate:(rows:ProductionImportRecord[])=>void,onError:(reason:string)=>void){
  const db=getFirestoreDb();
  return onSnapshot(query(collection(db,'productionImports'),where('branch','==',branch.toUpperCase()),orderBy('importedAt','desc'),limit(100)),snapshot=>{
    onUpdate(snapshot.docs.map(item=>({...item.data() as Omit<ProductionImportRecord,'id'>,id:item.id})));
  },error=>onError(error.message));
}
export async function publishProductionImport(record:Omit<ProductionImportRecord,'id'|'importedAt'>){
  if(!record.branch.trim()||!record.periodStart||!record.periodEnd||record.periodEnd<record.periodStart) throw new Error('Branch and valid start/end dates are required.');
  if(!record.rows.length||record.rows.length>500) throw new Error('Import must contain 1 to 500 employees.');
  if(record.rows.some(r=>!r.employee.trim()||[r.pulled,r.checked,r.putaway,r.workedHours].some(v=>!Number.isFinite(v)||v<0)))throw new Error('Invalid production values.');
  const canonical=record.branch.toUpperCase()+'|'+record.periodStart+'|'+record.periodEnd+'|'+JSON.stringify(record.rows.map(r=>[r.employee.toLowerCase(),r.pulled,r.checked,r.putaway,r.workedHours]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
  const id=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  await setDoc(doc(getFirestoreDb(),'productionImports',id),{...record,branch:record.branch.trim().toUpperCase(),importedAt:new Date().toISOString()});
  return id;
}
