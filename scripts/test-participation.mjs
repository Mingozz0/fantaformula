import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
function load(name) {
  const source=readFileSync(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const loaded={exports:{}};
  new Function('module','exports','require',compiled)(loaded,loaded.exports,(path)=>load(path.replace('./','')));
  return loaded.exports;
}
// Jolpica classifications checked against Formula1.com on 22 October 2026.
const fixture=JSON.parse(readFileSync(new URL('./fixtures/participation-2026.json',import.meta.url),'utf8'));
const {parseResultImport,mergeResultImport}=load('result-import');
const {scoreEvent,explainConstructorScore}=load('scoring');
const {isDraftPayload}=load('result-draft');
const {validatePositions}=load('result-validation');
const rules={gp_finish_points:[25,18,15,12,10,8,6,4,2,1],sprint_finish_points:[8,7,6,5,4,3,2,1],gp_grid_points:[],sprint_grid_points:[],gp_position_delta:0,sprint_position_delta:0,gp_fastest_lap:0,sprint_fastest_lap:0,driver_of_the_day:0,fastest_pit_stop:0,gp_retirement:-5,sprint_retirement:-2};
for(const [key,data] of Object.entries(fixture.events)) {
  const [round,event]=key.split('-');
  const imported=parseResultImport(data,2026,Number(round),event,fixture.catalog,fixture.constructors);
  assert.equal(imported.total,22);
  assert.equal(imported.drivers.length,23);
  assert.equal(imported.warnings.some((warning)=>/non associato|risultato assente|non riconosciut/.test(warning)),false);
  const hadjar=imported.drivers.find((row)=>row.driver_id===24);
  assert.equal(hadjar.result_status,'not_entered');
  assert.equal(hadjar.formation_lap,false); assert.equal(hadjar.grid_position,null); assert.equal(hadjar.finish_position,null);
  assert.equal(imported.drivers.find((row)=>row.driver_id===8).constructor_id,9);
  assert.equal(imported.drivers.find((row)=>row.driver_id===20).constructor_id,11);
  const results=imported.drivers.map((row)=>({...row,fastest_lap:false}));
  const lineup={driver_one_id:24,driver_two_id:21,reserve_driver_id:9};
  const score=scoreEvent(lineup,9,results,rules,event==='sprint');
  assert.deepEqual(score.driverIds,[9,21]);
  assert.equal(score.reserveUsed,true);
  assert.equal(score.constructorScore,explainConstructorScore(9,results,rules,event==='sprint').total);
  assert.equal(score.constructorScore,{'12-gp':6,'12-sprint':3,'13-gp':15,'14-gp':18}[key],'Red Bull points must use its actual race entrants');
  assert.equal(scoreEvent({driver_one_id:9,driver_two_id:5,reserve_driver_id:24},9,results,rules,event==='sprint').reserveUsed,false);
  assert.equal(scoreEvent(lineup,9,results.filter((row)=>row.driver_id!==24),rules,event==='sprint').reserveUsed,false,'A missing result is not proof of absence');
  const merged=mergeResultImport({drivers:imported.drivers,fastest_driver_id:24,dotd_driver_id:24,pit_constructor_id:9},imported);
  assert.equal(merged.dotd_driver_id,null);
  assert.notEqual(merged.fastest_driver_id,24);
  assert.equal(isDraftPayload(merged),true);
  assert.equal(mergeResultImport({...merged,drivers:merged.drivers.filter((row)=>row.driver_id!==20)},imported).drivers.length,23,'A draft created before the replacement must gain Tsunoda');
  assert.deepEqual(validatePositions(merged.drivers.map((row)=>({...row,name:String(row.driver_id)}))),[]);
  const partial=parseResultImport(data,2026,Number(round),event,fixture.catalog.filter((row)=>row.id!==20),fixture.constructors);
  assert.equal(partial.drivers.some((row)=>row.driver_id===24),false,'An unmatched entrant must not automatically mark Hadjar absent');
  assert.match(partial.warnings.join(' '),/non associato/);
}
assert.equal(isDraftPayload({drivers:[{driver_id:24,constructor_id:9,grid_position:3,finish_position:null,result_status:'not_entered',formation_lap:false}],fastest_driver_id:null,dotd_driver_id:null,pit_constructor_id:null}),false);
// Exercise the actual form handler: an absence clears positions and formation-lap participation.
const jsxRequire=createRequire(import.meta.url);
const fieldsModule={exports:{}};
const fieldsSource=ts.transpileModule(readFileSync(new URL('../app/components/driver-result-fields.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
new Function('module','exports','require',fieldsSource)(fieldsModule,fieldsModule.exports,(name)=>name==='./form-select'?{FormSelect:()=>null}:jsxRequire(name));
let changed;
const fieldProps={driverId:24,name:'Isack Hadjar',constructors:[],value:{constructor_id:9,grid_position:5,finish_position:3,result_status:'finished',formation_lap:true},onChange:(next)=>changed=next,errors:[]};
const tree=fieldsModule.exports.DriverResultFields(fieldProps);
tree.props.children.find((child)=>child?.props?.label==='Esito della gara').props.onValueChange('not_entered');
assert.deepEqual(changed,{constructor_id:9,grid_position:null,finish_position:null,result_status:'not_entered',formation_lap:false});
const absentTree=fieldsModule.exports.DriverResultFields({...fieldProps,value:changed});
absentTree.props.children.find((child)=>child?.props?.label==='Esito della gara').props.onValueChange('finished');
assert.equal(changed.formation_lap,true);
console.log('Partecipazioni reali: Olanda GP/Sprint, Italia e Spagna; Hadjar in panchina o titolare, Tsunoda e scuderia di Lawson OK');
