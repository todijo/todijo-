import Link from "next/link";
import { safeMarkdownLink } from "@/lib/site-content";

function inline(value:string){
  const parts=value.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part,index)=>{const bold=part.match(/^\*\*([^*]+)\*\*$/);if(bold)return<strong key={index}>{bold[1]}</strong>;const link=part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);if(link){const href=safeMarkdownLink(link[2]);return href?<Link key={index} href={href}>{link[1]}</Link>:<span key={index}>{link[1]}</span>}return part});
}
export default function SafeSiteContent({title,content}:{title:string;content:string}){
  const blocks=content.replace(/\r/g,"").split(/\n{2,}/).map(item=>item.trim()).filter(Boolean);
  return <article className="marketInfoContent cmsPublicContent"><header className="infoGuideHeader"><h1>{title}</h1></header><div>{blocks.map((block,index)=>{
    if(/^##\s+/.test(block))return <h2 key={index}>{inline(block.replace(/^##\s+/,""))}</h2>;
    if(/^###\s+/.test(block))return <h3 key={index}>{inline(block.replace(/^###\s+/,""))}</h3>;
    const lines=block.split("\n");if(lines.every(line=>/^[-*]\s+/.test(line)))return <ul key={index}>{lines.map((line,item)=><li key={item}>{inline(line.replace(/^[-*]\s+/,""))}</li>)}</ul>;
    return <p key={index}>{inline(block)}</p>;
  })}</div></article>
}
