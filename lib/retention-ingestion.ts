import {z} from 'zod';
import {fingerprint} from './adapters/http';
import type {Retention} from './schema';
const args=z.object({harness:z.string().min(1),harness_version:z.string().min(1),dataset_revision:z.string().min(1),precision:z.string().min(1),shots:z.number().nonnegative(),seed:z.number()}).passthrough();
const index=z.array(z.object({results:z.array(z.object({task:z.object({type:z.string()}),dataset:z.object({type:z.string(),args}),metrics:z.array(z.object({type:z.string(),value:z.number().nonnegative()}))}))}));
// Model-index scores alone do not establish comparability. Require explicit evaluation conditions.
export function ingestRetention(original:unknown,modified:unknown,source:string):Retention[]{
  const base=index.safeParse(original),variant=index.safeParse(modified);if(!base.success||!variant.success)return [];
  const results:Retention[]=[];
  for(const v of variant.data.flatMap(i=>i.results))for(const b of base.data.flatMap(i=>i.results)){
    if(v.task.type!==b.task.type||v.dataset.type!==b.dataset.type||fingerprint(v.dataset.args)!==fingerprint(b.dataset.args))continue;
    for(const metric of v.metrics){const baseline=b.metrics.find(m=>m.type===metric.type);if(!baseline||baseline.value<=0)continue;
      results.push({benchmark:`${v.dataset.type} / ${metric.type}`,protocol:JSON.stringify(v.dataset.args),original:baseline.value,modified:metric.value,comparable:true,source,kind:'creator'});
    }
  }
  return results;
}
