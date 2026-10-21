import { driverStatusLabel } from './labels';
import { sessionLabels, sessionTime, type SessionKey } from './weekend';
export type AuditEntry={id:string;kind:string;title:string;actor:string;changedAt:string;version?:number;changes:{label:string;before:string;after:string}[]};
export type Snapshot=Record<string,unknown>;
const object=(value:unknown):Snapshot=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Snapshot:{};
const driverFields={constructor_id:'Scuderia',grid_position:'Griglia',finish_position:'Arrivo',result_status:'Esito',formation_lap:'Giro di formazione'};
export function auditChanges(kind:string,previous:Snapshot|null,current:Snapshot,driverName:(id:number)=>string,constructorName:(id:number)=>string):AuditEntry['changes'] {
  const changes:AuditEntry['changes']=[];
  function show(field:string,value:unknown) {
    if(value===null||value===undefined)return '—';
    if(field.includes('constructor'))return constructorName(Number(value));
    if(field.includes('driver'))return driverName(Number(value));
    if(field==='result_status')return driverStatusLabel(String(value));
    if(field==='starts_at')return sessionTime(String(value));
    if(typeof value==='boolean')return value?'Sì':'No';
    return String(value);
  }
  function add(label:string,field:string,before:unknown,after:unknown) {
    if((before??null)===(after??null))return;
    changes.push({label,before:show(field,before),after:show(field,after)});
  }
  if(kind==='lineup') {
    for(const [field,label] of Object.entries({driver_one_id:'Titolare 1',driver_two_id:'Titolare 2',reserve_driver_id:'Riserva',constructor_id:'Scuderia',retroactive:'Recupero dopo scadenza'}))add(label,field,previous?.[field],current[field]);
  }else if(kind==='schedule_updated') {
    add(current.session_key==='deadline'?'Scadenza formazione':sessionLabels[current.session_key as SessionKey]??'Sessione','starts_at',previous?.starts_at,current.starts_at);
  }else {
    const oldRows=Array.isArray(previous?.drivers)?previous.drivers.map(object):[];
    const newRows=Array.isArray(current.drivers)?current.drivers.map(object):[];
    for(const row of newRows) {
      const before=oldRows.find((old)=>old.driver_id===row.driver_id);
      for(const [field,label] of Object.entries(driverFields))add(`${driverName(Number(row.driver_id))} · ${label}`,field,before?.[field],row[field]);
    }
    for(const [field,label] of Object.entries({fastest_driver_id:'Giro veloce',dotd_driver_id:'Pilota del giorno',pit_constructor_id:'Migliore sosta ai box'}))add(label,field,previous?.[field],current[field]);
    if(!changes.length&&JSON.stringify(previous?.imported)!==JSON.stringify(current.imported))changes.push({label:'Fonte dei risultati',before:previous?.imported?'Importazione precedente':'—',after:current.imported?'Jolpica-F1':'Inserimento manuale'});
  }
  return changes;
}
