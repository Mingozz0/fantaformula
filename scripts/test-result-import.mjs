import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(loaded, loaded.exports, (name) => load(`../lib/${name.replace('./', '')}.ts`));
  return loaded.exports;
}
const { parseResultImport, mergeResultImport, resultImportUrl } = load('../lib/result-import.ts');
const { fetchJolpicaResults } = load('../lib/jolpica.ts');
const { isDraftPayload } = load('../lib/result-draft.ts');
const { scoreEvent } = load('../lib/scoring.ts');
const roster = [
  [1,'Alexander','Albon','albon','ALB',10], [2,'Fernando','Alonso','alonso','ALO',4], [3,'Valtteri','Bottas','bottas','BOT',13],
  [5,'Pierre','Gasly','gasly','GAS',3], [6,'Lewis','Hamilton','hamilton','HAM',5], [7,'Nico','Hülkenberg','hulkenberg','HUL',12],
  [8,'Liam','Lawson','lawson','LAW',11], [9,'Charles','Leclerc','leclerc','LEC',5], [11,'Lando','Norris','norris','NOR',7],
  [12,'Esteban','Ocon','ocon','OCO',6], [13,'Sergio','Pérez','perez','PER',13], [14,'Oscar','Piastri','piastri','PIA',7],
  [16,'George','Russell','russell','RUS',8], [17,'Carlos','Sainz','sainz','SAI',10], [19,'Lance','Stroll','stroll','STR',4],
  [21,'Max','Verstappen','max_verstappen','VER',9], [23,'Kimi','Antonelli','f1_2026_antonelli','ANT',8],
  [24,'Isack','Hadjar','f1_2026_hadjar','HAD',9], [25,'Arvid','Lindblad','f1_2026_lindblad','LIN',11],
  [26,'Franco','Colapinto','f1_2026_colapinto','COL',3], [27,'Oliver','Bearman','f1_2026_bearman','BEA',6],
  [28,'Gabriel','Bortoleto','f1_2026_bortoleto','BOR',12],
].map(([id,first_name,last_name,legacy_key,short_name,constructor_id]) => ({id,first_name,last_name,legacy_key,short_name,constructor_id}));
const constructors = [[3,'Alpine','Alpine F1 Team'],[4,'Aston Martin','Aston Martin'],[5,'Ferrari','Ferrari'],[6,'Haas F1 Team','Haas F1 Team'],
  [7,'McLaren','McLaren'],[8,'Mercedes','Mercedes'],[9,'Red Bull Racing','Red Bull'],[10,'Williams','Williams'],
  [11,'Racing Bulls','Racing Bulls'],[12,'Audi','Audi'],[13,'Cadillac','Cadillac']].map(([constructor_id,display_name,canonical_name]) => ({constructor_id,display_name,canonical_name}));
const entry = (driverId, position, extra = {}) => ({ Driver: {driverId}, Constructor: {constructorId:'mercedes',name:'Mercedes'},
  position:String(position),positionText:String(position),grid:String(position),status:'Finished',...extra });
const response = (rows, event = 'gp', round = 1) => ({MRData:{total:String(rows.length),RaceTable:{Races:[{season:'2026',round:String(round),[event==='gp'?'Results':'SprintResults']:rows}]}}});
const parse = (rows) => parseResultImport(response(rows),2026,1,'gp',roster,constructors);
const imported = parse([
  entry('russell',1,{FastestLap:{rank:'1'}}), entry('antonelli',2),
  entry('stroll',17,{status:'Lapped',positionText:'R'}),
  entry('piastri',21,{status:'Did not start',positionText:'W'}),
]);
assert.equal(imported.drivers.length,4);
assert.equal(imported.fastest_driver_id,16);
assert.equal(imported.drivers.find((row)=>row.driver_id===19).result_status,'dnf');
assert.equal(imported.drivers.find((row)=>row.driver_id===19).finish_position,null);
assert.equal(imported.drivers.find((row)=>row.driver_id===14).result_status,'dns');
assert.equal(imported.drivers.find((row)=>row.driver_id===14).formation_lap,false);
assert.equal(parse([entry('russell',1,{status:'Disqualified',positionText:'D'})]).drivers[0].result_status,'dsq');
assert.equal(parse([entry('russell',1,{status:'+1 Lap'})]).drivers[0].result_status,'finished');
const pitlane = parse([entry('russell',1,{grid:'0'})]);
assert.equal(pitlane.drivers[0].grid_position,null);
assert.equal(pitlane.warnings.some((warning)=>warning.includes('corsia box')),true);
const fallback = parse([entry('arvid_lindblad',1,{Driver:{driverId:'arvid_lindblad',givenName:'Arvid',familyName:'Lindblad',code:'LIN'},Constructor:{constructorId:'rb',name:'RB F1 Team'}})]);
assert.equal(fallback.drivers[0].driver_id,25);
assert.equal(fallback.drivers[0].constructor_id,11);
const partial = parse([entry('russell',1),entry('antonelli',2,{status:'New unknown status'}),entry('unknown',3)]);
assert.equal(partial.drivers.length,1);
assert.equal(partial.warnings.some((warning)=>warning.includes('esito non riconosciuto')),true);
assert.equal(partial.warnings.some((warning)=>warning.includes('non associato')),true);
assert.throws(()=>parse([entry('unknown',1)]),/Nessun risultato/);
assert.throws(()=>parse([entry('russell',1),entry('russell',2)]),/duplicati/);
assert.throws(()=>parse([entry('russell',1),entry('antonelli',1)]),/sovrapposte/);
assert.throws(()=>parse([entry('russell',1,{FastestLap:{rank:1}}),entry('antonelli',2,{FastestLap:{rank:1}})]),/più giri veloci/);
assert.throws(()=>parseResultImport({MRData:{RaceTable:{Races:[]}}},2026,1,'gp',roster,constructors),/non ancora disponibili/);
assert.throws(()=>parseResultImport(response([entry('russell',1)],'gp',2),2026,1,'gp',roster,constructors),/gara diversa/);
assert.throws(()=>parseResultImport({MRData:{total:22,RaceTable:response([entry('russell',1)]).MRData.RaceTable}},2026,1,'gp',roster,constructors),/incompleti/);
assert.throws(()=>resultImportUrl(2026,'1/../../','gp'),/non valida/);
const draft = {drivers:roster.map((driver)=>({driver_id:driver.id,constructor_id:driver.constructor_id,grid_position:null,finish_position:null,result_status:'finished',formation_lap:true})),
  fastest_driver_id:9,dotd_driver_id:9,pit_constructor_id:5};
const original = structuredClone(draft);
const merged = mergeResultImport(draft,imported);
assert.deepEqual(draft,original);
assert.equal(merged.dotd_driver_id,9);
assert.equal(merged.pit_constructor_id,5);
assert.equal(merged.fastest_driver_id,16);
assert.deepEqual(merged.drivers.find((row)=>row.driver_id===9),draft.drivers.find((row)=>row.driver_id===9));
assert.equal(mergeResultImport(draft,partial).fastest_driver_id,9);
assert.equal(isDraftPayload(merged),true);
assert.equal(isDraftPayload({...merged,imported:{...merged.imported,url:'javascript:alert(1)'}}),false);
assert.equal(isDraftPayload({...merged,imported:{...merged.imported,imported_at:'invalid'}}),false);
const sprint = parseResultImport(response([entry('russell',1)],'sprint',2),2026,2,'sprint',roster,constructors);
assert.equal(sprint.source.event,'sprint');
assert.match(sprint.source.url,/\/2\/sprint.json/);
await assert.rejects(()=>fetchJolpicaResults(2026,1,'gp',async()=>new Response('',{status:429})),/Attendi un minuto/);
await assert.rejects(()=>fetchJolpicaResults(2026,1,'gp',async()=>new Response('',{status:503})),/temporaneamente/);
await assert.rejects(()=>fetchJolpicaResults(2026,1,'gp',async()=>{throw new Error('timeout');}),/bozza è conservata/);
await assert.rejects(()=>fetchJolpicaResults(2026,1,'gp',async()=>new Response('invalid')),/Risposta del servizio/);
await fetchJolpicaResults(2026,1,'gp',async(url,options)=>{
  assert.match(url,/2026\/1\/results.json/);assert.equal(options.headers['User-Agent'],'GRIDF1/1.0');assert.equal(options.next.revalidate,60);
  return Response.json(response([entry('russell',1)]));
});

// Run the actual server-action code with controlled session and provider boundaries.
const actionSource = ts.transpileModule(readFileSync(new URL('../app/manager/import-actions.ts',import.meta.url),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
let providerCalls=0;
async function actionAs({authenticated=true,manager=true,sprint=true}={}) {
  const catalog={game_managers:manager?{user_id:'manager'}:null,races:{season_id:1,round:1,has_sprint:sprint},seasons:{year:2026},
    season_drivers:roster.map((driver)=>({constructor_id:driver.constructor_id,short_name:driver.short_name,drivers:driver})),
    season_constructors:constructors.map((constructor)=>({...constructor,constructors:{canonical_name:constructor.canonical_name}}))};
  const db={auth:{getClaims:async()=>({data:{claims:authenticated?{sub:'manager'}:{}},error:null})},from(table){
    const result={data:catalog[table],error:null};
    const builder={select(){return builder;},eq(){return builder;},maybeSingle:async()=>result,single:async()=>result,then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};
    return builder;
  }};
  const actionModule={exports:{}};
  new Function('module','exports','require',actionSource)(actionModule,actionModule.exports,(name)=>{
    if(name==='@/lib/supabase/server')return {createClient:async()=>db};
    if(name==='@/lib/jolpica')return {fetchJolpicaResults:async()=>{providerCalls++;return response([entry('russell',1)]);}};
    if(name==='@/lib/result-import')return {parseResultImport};
    throw new Error(`Unexpected dependency ${name}`);
  });
  return actionModule.exports.previewResultImport;
}
assert.match((await (await actionAs({authenticated:false}))(1,'gp')).error,/Sessione scaduta/);
assert.match((await (await actionAs({manager:false}))(1,'gp')).error,/Solo il gestore/);
assert.match((await (await actionAs())(1,'invalid')).error,/Gara non valida/);
assert.match((await (await actionAs({sprint:false}))(1,'sprint')).error,/non disponibile/);
assert.equal(providerCalls,0);
const actionResult=await (await actionAs())(1,'gp');
assert.equal(actionResult.ok,true);
assert.equal(actionResult.result.drivers[0].driver_id,16);
assert.equal(providerCalls,1);
if (process.argv.includes('--live')) {
  for (const [round,event] of [[1,'gp'],[2,'sprint']]) {
    const data = await fetchJolpicaResults(2026,round,event);
    const live = parseResultImport(data,2026,round,event,roster,constructors);
    assert.equal(live.drivers.length,22);
    assert.equal(live.warnings.filter((warning)=>/non associato|non riconosciuto|assente/.test(warning)).length,0);
    assert.ok(live.fastest_driver_id);
    const rules={gp_finish_points:[25,18,15,12,10,8,6,4,2,1],sprint_finish_points:[8,7,6,5,4,3,2,1],gp_grid_points:[],sprint_grid_points:[],gp_position_delta:0,sprint_position_delta:0,gp_fastest_lap:0,sprint_fastest_lap:0,driver_of_the_day:0,fastest_pit_stop:0,gp_retirement:-10,sprint_retirement:-5};
    if(event==='gp') {
      const score=scoreEvent({driver_one_id:14,driver_two_id:9,reserve_driver_id:16},5,live.drivers,rules,false);
      assert.equal(score.reserveUsed,true);assert.deepEqual(score.driverIds,[16,9]);
      assert.equal(score.total,55);
    }
    console.log(`Live Jolpica: 2026/${round} ${event}, ${live.drivers.length} piloti associati, giro veloce ${live.fastest_driver_id}, avvisi: ${live.warnings.join(' | ') || 'nessuno'}`);
  }
}
console.log('Importazione: GP/Sprint, mapping, DNS/DNF/DSQ, griglie, merge, metadati, timeout ed errori OK');
