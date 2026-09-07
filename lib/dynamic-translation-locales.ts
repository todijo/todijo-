export const DYNAMIC_TRANSLATION_LOCALES=["fr","en","es","ar","zh"] as const;

export function isAutomaticDynamicTranslationLocale(locale:string){return (DYNAMIC_TRANSLATION_LOCALES as readonly string[]).includes(locale);}
