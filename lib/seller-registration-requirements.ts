export type SellerRegistrationType="PRIVATE"|"PROFESSIONAL";
export type SellerRegistrationRequirements={registrationRequired:boolean;registrationLabel:"siret"|"companyNumber";vatSupported:boolean;format:"FR_SIRET"|"GENERIC"};
const EEA=new Set(["AT","BE","BG","HR","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HU","IE","IS","IT","LI","LT","LU","LV","MT","NL","NO","PL","PT","RO","SE","SI","SK"]);
export function sellerRegistrationRequirements(countryCode:string,sellerType:SellerRegistrationType):SellerRegistrationRequirements{
 const country=countryCode.trim().toUpperCase();if(sellerType==="PRIVATE")return{registrationRequired:false,registrationLabel:country==="FR"?"siret":"companyNumber",vatSupported:EEA.has(country)||country==="GB",format:country==="FR"?"FR_SIRET":"GENERIC"};
 return{registrationRequired:true,registrationLabel:country==="FR"?"siret":"companyNumber",vatSupported:EEA.has(country)||country==="GB",format:country==="FR"?"FR_SIRET":"GENERIC"};
}
export function validBusinessRegistration(value:string,requirements:SellerRegistrationRequirements){
 const normalized=value.replace(/[\s.-]/g,"");if(!requirements.registrationRequired)return true;
 if(requirements.format==="FR_SIRET")return /^\d{14}$/.test(normalized);
 return /^[A-Za-z0-9][A-Za-z0-9 /._-]{2,63}$/.test(value.trim());
}
