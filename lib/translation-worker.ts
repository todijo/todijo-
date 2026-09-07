import "server-only";

export type TranslationWorkLimits={items:number;characters:number;concurrency:number};
export type TranslationWorkAdapter<T,R>={
  loadDue(limit:number):Promise<readonly T[]>;
  estimatedCharacters(item:T):number;
  processSafely(item:T):Promise<R>;
};

export async function runBoundedTranslationWork<T,R>(adapter:TranslationWorkAdapter<T,R>,limits:TranslationWorkLimits){
  if(!Number.isSafeInteger(limits.items)||limits.items<=0||!Number.isSafeInteger(limits.characters)||limits.characters<=0||!Number.isSafeInteger(limits.concurrency)||limits.concurrency<=0)throw new Error("TRANSLATION_WORK_LIMITS_INVALID");
  const due=await adapter.loadDue(limits.items),selected:T[]=[];let characters=0;
  for(const item of due){const amount=adapter.estimatedCharacters(item);if(!Number.isSafeInteger(amount)||amount<0)continue;if(characters+amount>limits.characters)continue;selected.push(item);characters+=amount;}
  const results:R[]=[];
  for(let offset=0;offset<selected.length;offset+=limits.concurrency)results.push(...await Promise.all(selected.slice(offset,offset+limits.concurrency).map(item=>adapter.processSafely(item))));
  return{processed:results.length,characters,results};
}
