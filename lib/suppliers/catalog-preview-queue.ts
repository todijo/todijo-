export type CatalogPreviewState="pending"|"analyzing"|"failed";

export type CatalogPreviewSnapshot<T>={
  results:Record<string,T>;
  states:Record<string,CatalogPreviewState>;
  selectedCount:number;
  completedCount:number;
  running:boolean;
};

type PreviewRequest<T>=(identifiers:string[],signal:AbortSignal)=>Promise<T[]>;
type PreviewIdentifier<T>=(item:T)=>string;

export const CLIENT_PREVIEW_CHUNK_SIZE=8;
export const CLIENT_PREVIEW_WATCHDOG_MS=120_000;

export class CatalogPreviewQueue<T>{
  private selected=new Set<string>();
  private results=new Map<string,T>();
  private states=new Map<string,CatalogPreviewState>();
  private pending:string[]=[];
  private queued=new Set<string>();
  private running=false;

  constructor(private readonly request:PreviewRequest<T>,private readonly identifier:PreviewIdentifier<T>,private readonly isFailure:(item:T)=>boolean,private readonly onChange:(snapshot:CatalogPreviewSnapshot<T>)=>void,private readonly chunkSize=CLIENT_PREVIEW_CHUNK_SIZE,private readonly watchdogMs=CLIENT_PREVIEW_WATCHDOG_MS){}

  updateSelection(identifiers:Iterable<string>){
    this.selected=new Set(identifiers);
    for(const identifier of [...this.results.keys()])if(!this.selected.has(identifier))this.results.delete(identifier);
    for(const identifier of [...this.states.keys()])if(!this.selected.has(identifier))this.states.delete(identifier);
    for(const identifier of this.selected){
      if(this.results.has(identifier)||this.queued.has(identifier)||this.states.get(identifier)==="analyzing")continue;
      this.states.set(identifier,"pending");this.pending.push(identifier);this.queued.add(identifier);
    }
    this.emit();void this.drain();
  }

  retry(identifier:string){
    if(!this.selected.has(identifier)||this.states.get(identifier)!=="failed")return;
    this.results.delete(identifier);this.states.set(identifier,"pending");
    if(!this.queued.has(identifier)){this.pending.push(identifier);this.queued.add(identifier);}
    this.emit();void this.drain();
  }

  private emit(){
    const results:Record<string,T>={},states:Record<string,CatalogPreviewState>={};
    for(const identifier of this.selected){const result=this.results.get(identifier),state=this.states.get(identifier);if(result)results[identifier]=result;if(state)states[identifier]=state;}
    const completedCount=[...this.selected].filter(identifier=>this.results.has(identifier)||this.states.get(identifier)==="failed").length;
    this.onChange({results,states,selectedCount:this.selected.size,completedCount,running:this.running||this.pending.some(identifier=>this.selected.has(identifier))});
  }

  private async drain(){
    if(this.running)return;this.running=true;this.emit();
    try{
      for(;;){
        const chunk:string[]=[];
        while(this.pending.length&&chunk.length<this.chunkSize){const identifier=this.pending.shift()!;this.queued.delete(identifier);if(this.selected.has(identifier)&&!this.results.has(identifier)&&this.states.get(identifier)!=="failed")chunk.push(identifier);}
        if(!chunk.length)break;
        for(const identifier of chunk)this.states.set(identifier,"analyzing");this.emit();
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort("CJ_PREVIEW_CLIENT_TIMEOUT"),this.watchdogMs);
        try{
          const received=await this.request(chunk,controller.signal),byIdentifier=new Map(received.map(item=>[this.identifier(item),item]));
          for(const identifier of chunk){if(!this.selected.has(identifier))continue;const result=byIdentifier.get(identifier);if(result){this.results.set(identifier,result);if(this.isFailure(result))this.states.set(identifier,"failed");else this.states.delete(identifier);}else this.states.set(identifier,"failed");}
        }catch{for(const identifier of chunk)if(this.selected.has(identifier)&&!this.results.has(identifier))this.states.set(identifier,"failed");}
        finally{clearTimeout(timeout);this.emit();}
      }
    }finally{this.running=false;this.emit();}
  }
}
