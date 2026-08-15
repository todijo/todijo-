export type AccountProfileInput={firstName:string;lastName:string;phone:string|null;profileAddress:string|null;profilePostalCode:string|null;profileCity:string|null;profileCountry:string|null};
const text=(value:unknown,max:number)=>{const result=String(value??"").trim();return result&&result.length<=max?result:null};
export function validateAccountProfile(body:unknown):{ok:true;value:AccountProfileInput}|{ok:false}{
  const input=typeof body==="object"&&body?body as Record<string,unknown>:{},firstName=text(input.firstName,100),lastName=text(input.lastName,100),country=text(input.profileCountry,2)?.toUpperCase()??null;
  if(!firstName||!lastName||(country&&!/^[A-Z]{2}$/.test(country)))return{ok:false};
  return{ok:true,value:{firstName,lastName,phone:text(input.phone,40),profileAddress:text(input.profileAddress,240),profilePostalCode:text(input.profilePostalCode,32),profileCity:text(input.profileCity,120),profileCountry:country}};
}
