import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {datasetSchema,type Dataset,type Model} from '../lib/schema';
import {benchmarkAdapters} from '../lib/adapters/benchmarks';
import {registry,hosting} from '../lib/adapters/registry';
import {fingerprint} from '../lib/adapters/http';
import {rankModels} from '../lib/scoring';
import type {Adapter} from '../lib/adapters/types';
import {join} from 'node:path';
export function mergeModels(previous:Model[],incoming:Model[]) {
  const map=new Map(previous.map(m=>[m.id,m]));
  for(const m of incoming){const old=map.get(m.id);map.set(m.id,old?{...old,...m,discoveredAt:old.discoveredAt,context:m.context??old.context,architecture:m.architecture==='Unverified'?old.architecture:m.architecture,providers:m.providers.length?m.providers:old.providers,toolSupport:m.toolSupport==='unknown'?old.toolSupport:m.toolSupport}:m);}
  return [...map.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
function material(data:Dataset){return {models:data.models.map(({discoveredAt,updatedAt,...m})=>{void discoveredAt;void updatedAt;return m;}),evidence:data.evidence,variants:data.variants.map(({updatedAt,...v})=>{void updatedAt;return v;}),sources:data.sources.map(({lastSuccess,...s})=>{void lastSuccess;return s;})};}
async function atomic(path:string,value:unknown){await writeFile(path+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(path+'.tmp',path);}
export async function refresh(options:{adapters?:Adapter[];directory?:string}={}){
  const directory=options.directory??'data';const adapters=options.adapters??[...benchmarkAdapters,hosting,registry];
  await mkdir(directory,{recursive:true});let previous:Dataset;
  try{previous=datasetSchema.parse(JSON.parse(await readFile(join(directory,'radar.json'),'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;previous={schemaVersion:1,refreshedAt:new Date().toISOString(),models:[],evidence:[],variants:[],sources:[],previousRanks:{}};}
  let data:Dataset=structuredClone(previous);const checkedAt=new Date().toISOString();let successes=0;
  for(const adapter of adapters){
    const old=data.sources.find(s=>s.id===adapter.id);
    try{const batch=await adapter.run(data.models);if(adapter.id==='openrouter')data.models=data.models.map(m=>({...m,providers:[]}));data.models=mergeModels(data.models,batch.models??[]);
      if(batch.evidence)data.evidence=[...data.evidence.filter(e=>e.sourceId!==adapter.id),...batch.evidence].sort((a,b)=>a.id.localeCompare(b.id));
      if(batch.variants)data.variants=[...new Map([...data.variants,...batch.variants].map(v=>[v.id,v])).values()].sort((a,b)=>a.id.localeCompare(b.id));
      data.sources=data.sources.filter(s=>s.id!==adapter.id).concat({id:adapter.id,name:adapter.name,url:adapter.url,status:'ok',lastSuccess:checkedAt,message:batch.message,fingerprint:fingerprint(batch)});successes++;console.log(`${adapter.id}: ${batch.message}`);
    }catch(e){const message=e instanceof Error?e.message:'Source unavailable';data.sources=data.sources.filter(s=>s.id!==adapter.id).concat({id:adapter.id,name:adapter.name,url:adapter.url,status:'error',lastSuccess:old?.lastSuccess??null,message:`${message}. Prior valid data retained.`,fingerprint:old?.fingerprint});console.warn(`${adapter.id}: ${message}`);}
  }
  // Fingerprints exclude collector wall-clock metadata, so polling alone never causes commits.
  data.sources=data.sources.map(s=>({...s,fingerprint:undefined})).sort((a,b)=>a.id.localeCompare(b.id));
  data=datasetSchema.parse(data);
  const changed=fingerprint(material(previous))!==fingerprint(material(data));
  if(changed){data.previousRanks=Object.fromEntries(rankModels(previous).filter(r=>r.rank!==null).map(r=>[r.id,r.rank!]));data.refreshedAt=checkedAt;await atomic(join(directory,'radar.json'),data);await atomic(join(directory,'rankings.json'),rankModels(data));}
  await atomic(join(directory,'refresh-status.json'),{checkedAt,successes,total:adapters.length,changed,sources:data.sources});
  console.log(changed?'Material data changed.':'No material changes.');if(successes===0)throw Error('All sources failed; preserved last valid snapshot');return {changed,data};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/refresh.ts'))await refresh();
