import { benchmarks, categories, policy, weights, type Category } from './config';
import type { Dataset, Evidence, Model } from './schema';
import { selectVariant } from './variants';
export function percentile(value:number, cohort:number[]) {
  if(cohort.length < 3) return null;
  const below=cohort.filter(v=>v<value).length, equal=cohort.filter(v=>v===value).length;
  return 100*(below+(equal-1)/2)/(cohort.length-1);
}
export function scoreModel(model:Model, all:Evidence[], now = Date.now()) {
  const eligible = all.filter(e=>benchmarks[e.benchmark] && !['creator','unverified'].includes(e.kind) && now-Date.parse(e.observedAt)<=policy.maxEvidenceAgeDays*86400000);
  const scores:Partial<Record<Category,number>>={}, independent=new Set<Category>();
  const breakdown: (Evidence & {normalized:number})[]=[];
  for(const key of Object.keys(benchmarks)) {
    const groups=new Map<string,Evidence[]>();
    for(const e of eligible.filter(e=>e.benchmark===key)) { const g=`${e.sourceId}:${e.protocol}:${e.kind}`; groups.set(g,[...(groups.get(g)||[]),e]); }
    const candidates=[];
    for(const group of groups.values()) {
      const dedup=[...new Map(group.map(e=>[e.modelId,e])).values()];
      const e=dedup.find(e=>e.modelId===model.id); if(!e)continue;
      const normalized=percentile(e.value,dedup.map(e=>e.value)); if(normalized!==null)candidates.push({...e,normalized});
    }
    // Prefer independently run results, never average duplicate reports of one benchmark.
    const best=candidates.sort((a,b)=>(a.kind==='independent'?0:1)-(b.kind==='independent'?0:1)||b.observedAt.localeCompare(a.observedAt))[0];
    if(best) { breakdown.push(best); if(best.kind==='independent')independent.add(benchmarks[key].category); }
  }
  for(const cat of categories) { const values=breakdown.filter(e=>benchmarks[e.benchmark].category===cat).map(e=>e.normalized); if(values.length)scores[cat]=values.reduce((a,b)=>a+b,0)/values.length; }
  const coverage=categories.reduce((sum,cat)=>sum+(scores[cat]!==undefined?weights[cat]:0),0);
  const overall=coverage?categories.reduce((sum,cat)=>sum+(scores[cat]??0)*weights[cat],0)/coverage:null;
  const qualified=coverage>=policy.minimumCoverage && independent.size>=policy.minimumIndependentCategories && independent.has('cyber');
  const confidence=qualified?(coverage>=85?'High':'Medium'):breakdown.length?'Low':'Awaiting evidence';
  return { scores,coverage,overall,qualified,confidence,breakdown,independentCategories:independent.size };
}
export function rankModels(data:Dataset, now=Date.now()) {
  const variantIds=new Set(data.variants.map(v=>v.id));
  const rows=data.models.filter(model=>!variantIds.has(model.id)).map(model=>({...model,...scoreModel(model,data.evidence,now),variant:selectVariant(model.id,data.variants)}));
  // Broad provisional evidence comes before isolated single-benchmark winners.
  rows.sort((a,b)=>Number(b.qualified)-Number(a.qualified)||Number(b.coverage>=policy.minimumCoverage)-Number(a.coverage>=policy.minimumCoverage)||(b.overall??-1)-(a.overall??-1)||a.name.localeCompare(b.name));
  let rank=0;
  return rows.map(row=>({...row,rank:row.qualified?++rank:null,previousRank:data.previousRanks[row.id]??null}));
}
export type RankedModel = ReturnType<typeof rankModels>[number];
