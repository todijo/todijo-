const LIMITS = { productIdentifier:160, manufacturerName:200, manufacturerContact:300, responsiblePerson:300, safetyInformation:3000, complianceInformation:3000 } as const;
export class ProductComplianceError extends Error {}
export function readProductCompliance(body:Record<string,unknown>){return Object.fromEntries(Object.entries(LIMITS).map(([key,limit])=>{const value=String(body[key]??"").trim();if(value.length>limit)throw new ProductComplianceError(`${key.toUpperCase()}_TOO_LONG`);return [key,value||null]}))}
