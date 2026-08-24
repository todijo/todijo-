import Link from"next/link";
import{redirect}from"next/navigation";
import{getLocale}from"next-intl/server";
import AdminTestAccountCleanup from"@/components/AdminTestAccountCleanup";
import{requireAdmin}from"@/lib/admin-access";
import{prisma}from"@/lib/prisma";
import{readSession}from"@/lib/session";
export const dynamic="force-dynamic";
export default async function TestAccountsPage(){const[locale,session]=await Promise.all([getLocale(),readSession()]);if(!session)redirect(`/${locale}/login`);try{await requireAdmin(prisma,session)}catch{redirect(`/${locale}/dashboard`)}const users=await prisma.user.findMany({where:{id:{not:session.userId},role:{not:"ADMIN"},deactivatedAt:null},orderBy:{createdAt:"desc"},take:100,select:{id:true,firstName:true,lastName:true,email:true,role:true}});return <main className="adminPage"><section className="adminShell"><header className="adminHero"><div><span>ADMIN</span><h1>Test account cleanup</h1><p>Explicit, guarded cleanup. No account is selected automatically.</p></div><Link href="/adm-barewbar-182203/users">Back to users</Link></header><AdminTestAccountCleanup candidates={users.map(u=>({id:u.id,label:`${u.firstName} ${u.lastName}`,email:u.email,role:u.role}))}/></section></main>}
