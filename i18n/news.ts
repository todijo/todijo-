import type {Locale} from "./config";

type NewsCopy={title:string;empty:string;similar:string;also:string;back:string};
const en:NewsCopy={title:"Todijo News",empty:"No published news yet.",similar:"Similar items",also:"You may also like",back:"Back to Todijo News"};
export const newsMessages:Record<Locale,NewsCopy>={
  en,fr:{title:"Todijo Actualités",empty:"Aucune actualité publiée pour le moment.",similar:"Articles similaires",also:"Vous aimerez aussi",back:"Retour aux actualités"},
  ar:{title:"أخبار Todijo",empty:"لا توجد أخبار منشورة حاليًا.",similar:"منتجات مشابهة",also:"قد يعجبك أيضًا",back:"العودة إلى الأخبار"},
  ku:{...en,title:"هەواڵەکانی Todijo"},tr:{...en,title:"Todijo Haberleri"},de:{...en,title:"Todijo Neuigkeiten"},es:{...en,title:"Noticias de Todijo"},it:{...en,title:"Notizie Todijo"},nl:{...en,title:"Todijo Nieuws"},zh:{...en,title:"Todijo 新闻"},fa:{...en,title:"اخبار Todijo"},hi:{...en,title:"Todijo समाचार"},pt:{...en,title:"Notícias Todijo"},ru:{...en,title:"Новости Todijo"},
};
