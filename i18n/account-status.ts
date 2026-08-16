import type {Locale} from "./config";
const en={accountUnavailable:"This account is blocked or deactivated. Contact Todijo support if you believe this is an error."};
const fr={accountUnavailable:"Ce compte est bloqué ou désactivé. Contactez l’assistance Todijo si vous pensez qu’il s’agit d’une erreur."};
const ku={accountUnavailable:"ئەم هەژمارە بلۆک یان ناچالاک کراوە. ئەگەر پێت وایە هەڵەیە، پەیوەندی بە یارمەتی Todijo بکە."};
export const accountStatusMessages=Object.fromEntries((["en","fr","ar","ku","tr","de","es","it","nl","zh","fa","hi","pt","ru"] satisfies Locale[]).map(locale=>[locale,locale==="fr"?fr:locale==="ku"?ku:en])) as Record<Locale,typeof en>;
