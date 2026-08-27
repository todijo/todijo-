export type CheckoutAttempt<T extends {code?:string}>={ok:boolean;status:number;result:T};
type CheckoutRequestStorage={getItem(key:string):string|null;setItem(key:string,value:string):void};

export async function checkoutWithStaleRequestRecovery<T extends {code?:string}>(input:{
  storage:CheckoutRequestStorage;
  storageKey:string;
  createRequestId:()=>string;
  send:(requestId:string)=>Promise<CheckoutAttempt<T>>;
}){
  let requestId=input.storage.getItem(input.storageKey)??input.createRequestId();
  input.storage.setItem(input.storageKey,requestId);
  for(let attempt=0;attempt<2;attempt+=1){
    const response=await input.send(requestId);
    if(response.status!==409||response.result.code!=="CHECKOUT_REQUEST_STALE"||attempt===1)return{...response,requestId,attempts:attempt+1};
    requestId=input.createRequestId();
    input.storage.setItem(input.storageKey,requestId);
  }
  throw new Error("CHECKOUT_RETRY_EXHAUSTED");
}
