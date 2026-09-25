import type{Prisma,PrismaClient}from"@prisma/client";
type Db=PrismaClient|Prisma.TransactionClient;
export function conversationForUser(db:Db,id:string,userId:string){return db.conversation.findFirst({where:{id,OR:[{buyerId:userId},{sellerId:userId}]},select:{id:true,buyerId:true,sellerId:true,lastMessageAt:true,product:{select:{id:true,name:true,images:true,price:true,currency:true}},store:{select:{name:true,slug:true}},buyer:{select:{firstName:true,lastName:true}},seller:{select:{firstName:true,lastName:true}},messages:{orderBy:{createdAt:"asc"},select:{id:true,body:true,senderId:true,readAt:true,createdAt:true}}}})}
export async function sendConversationMessage(db:PrismaClient,id:string,userId:string,body:string){const conversation=await db.conversation.findFirst({where:{id,OR:[{buyerId:userId},{sellerId:userId}]},select:{id:true,buyerId:true,sellerId:true,product:{select:{name:true}}}});if(!conversation)return null;const recipientId=conversation.buyerId===userId?conversation.sellerId:conversation.buyerId;const notificationId=await db.$transaction(async tx=>{await tx.message.create({data:{conversationId:id,senderId:userId,body}});await tx.conversation.update({where:{id},data:{lastMessageAt:new Date()}});await tx.notification.deleteMany({where:{userId:recipientId,type:"NEW_MESSAGE",href:`/messages/${id}`,readAt:null}});return(await tx.notification.create({data:{userId:recipientId,type:"NEW_MESSAGE",title:"Nouveau message",body:`Nouveau message concernant ${conversation.product.name}.`,href:`/messages/${id}`},select:{id:true}})).id});return{notificationId}}
export async function markConversationRead(db:PrismaClient,id:string,userId:string){await Promise.all([db.message.updateMany({where:{conversationId:id,senderId:{not:userId},readAt:null},data:{readAt:new Date()}}),db.notification.updateMany({where:{userId,href:{endsWith:`/messages/${id}`},readAt:null},data:{readAt:new Date()}})])}

export async function startPrepurchaseConversation(db: PrismaClient, buyerId: string, productId: string, message: string) {
  if (!productId || message.length < 12 || message.length > 2000) return { error: "INVALID_INPUT" as const, status: 400 };
  const product = await db.product.findFirst({
    where: { id: productId, status: "PUBLISHED" },
    select: { id: true, name: true, storeId: true, allowPrepurchaseQuestions: true, store: { select: { ownerId: true } } },
  });
  if (!product) return { error: "PRODUCT_NOT_FOUND" as const, status: 404 };
  if (!product.allowPrepurchaseQuestions) return { error: "PREPURCHASE_QUESTIONS_DISABLED" as const, status: 403 };
  if (product.store.ownerId === buyerId) return { error: "CANNOT_MESSAGE_YOURSELF" as const, status: 400 };
  const result = await db.$transaction(async (tx) => {
    const conversation = await tx.conversation.upsert({
      where: { buyerId_productId: { buyerId, productId } },
      update: { lastMessageAt: new Date() },
      create: { buyerId, sellerId: product.store.ownerId, storeId: product.storeId, productId },
      select: { id: true },
    });
    await tx.message.create({ data: { conversationId: conversation.id, senderId: buyerId, body: message } });
    await tx.notification.deleteMany({ where: { userId: product.store.ownerId, type: "NEW_MESSAGE", href: `/messages/${conversation.id}`, readAt: null } });
    const notification = await tx.notification.create({
      data: { userId: product.store.ownerId, type: "NEW_MESSAGE", title: "Nouveau message", body: `Un acheteur vous a écrit au sujet de ${product.name}.`, href: `/messages/${conversation.id}` },
      select: { id: true },
    });
    return { conversationId: conversation.id, notificationId: notification.id };
  });
  return { ...result, status: 201 };
}
