import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(path){const compiled=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const loaded={exports:{}};new Function('module','exports','require',compiled)(loaded,loaded.exports,(name)=>load(`../lib/${name.replace('./','')}.ts`));return loaded.exports;}
const {weekendRace,countdownParts,romeDate,sessionTime}=load('../lib/weekend.ts');
const {parseSchedule,fetchCalendar}=load('../lib/schedule-import.ts');
const {auditChanges}=load('../lib/audit.ts');
const race={id:40,round:18,circuit:'Circuit of The Americas',race_date:'2026-10-25',has_sprint:false};
const data={MRData:{total:'1',RaceTable:{Races:[{season:'2026',round:'18',Circuit:{circuitName:race.circuit},date:'2026-10-25',time:'20:00:00Z',FirstPractice:{date:'2026-10-23',time:'17:30:00Z'},Qualifying:{date:'2026-10-24',time:'21:00:00Z'}}]}}};
const parsed=parseSchedule(data,2026,race);
assert.equal(parsed.sessions.length,3);
assert.equal(parsed.sessions.find((row)=>row.session_key==='race').starts_at,'2026-10-25T20:00:00.000Z');
assert.throws(()=>parseSchedule(data,2026,{...race,circuit:'Suzuka'}),/Circuito diverso/);
assert.throws(()=>parseSchedule(data,2026,{...race,race_date:'2026-11-01'}),/Data della gara/);
assert.throws(()=>parseSchedule({...data,MRData:{...data.MRData,total:23}},2026,race),/incompleto/);
const races=[{...race,race_starts_at:'2026-10-25T20:00:00Z'},{...race,id:41,round:19,race_date:'2026-11-01',race_starts_at:'2026-11-01T20:00:00Z'}];
assert.equal(weekendRace(races,Date.parse('2026-10-24T12:00:00Z')).id,40); // Deadline is closed, GP is still current.
assert.equal(weekendRace(races,Date.parse('2026-10-25T22:30:00Z')).id,40);
assert.equal(weekendRace(races,Date.parse('2026-10-26T12:00:00Z')).id,41);
assert.equal(weekendRace(races,Date.parse('2026-12-31T12:00:00Z')).id,41);
assert.equal(weekendRace([],Date.now()),undefined);
assert.equal(romeDate(Date.parse('2026-10-23T22:00:00Z')),'2026-10-24');
assert.equal(romeDate(Date.parse('2026-10-30T23:00:00Z')),'2026-10-31');
assert.deepEqual(countdownParts('2026-10-24T00:00:01Z',Date.parse('2026-10-23T00:00:00Z')),{closed:false,days:1,hours:0,minutes:0,seconds:1});
assert.equal(countdownParts('2026-10-24T00:00:00Z',Date.parse('2026-10-24T00:00:00Z')).closed,true);
assert.equal(countdownParts(null,0),null);
assert.match(sessionTime('2026-10-25T20:00:00Z'),/21:00/); // Italian winter time.
const names=(id)=>`Pilota ${id}`,constructors=(id)=>`Scuderia ${id}`;
assert.deepEqual(auditChanges('lineup',{driver_one_id:1},{driver_one_id:2},names,constructors),[{label:'Titolare 1',before:'Pilota 1',after:'Pilota 2'}]);
const absentChanges=auditChanges('lineup',{driver_one_id:1,driver_two_id:2,reserve_driver_id:3},{is_empty:true,driver_one_id:null,driver_two_id:null,reserve_driver_id:null},names,constructors);
assert.deepEqual(absentChanges[0],{label:'Formazione non consegnata',before:'No',after:'Sì'});
assert.deepEqual(absentChanges[1],{label:'Titolare 1',before:'Pilota 1',after:'—'});
assert.equal(auditChanges('published',{drivers:[{driver_id:1,result_status:'finished'}]},{drivers:[{driver_id:1,result_status:'dns'}]},names,constructors)[0].after,'Non partito');
assert.equal(auditChanges('draft_saved',{drivers:[{driver_id:1,grid_position:1}]},{drivers:[{driver_id:1,grid_position:1}]},names,constructors).length,0);
assert.equal(auditChanges('schedule_updated',null,{session_key:'race',starts_at:'2026-10-25T20:00:00Z'},names,constructors)[0].label,'Gran Premio');
if(process.argv.includes('--live')){
  const calendar=await fetchCalendar(2026);
  const schedule=parseSchedule(calendar,2026,race);
  assert.equal(schedule.sessions.length,5);
  console.log(JSON.stringify(schedule));
}
console.log('Weekend: selezione GP dopo scadenza, cambio ora legale, countdown, programma e differenze audit OK');
