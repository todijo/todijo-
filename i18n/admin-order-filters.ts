import type {Locale} from "./config";
type Labels={active:string;refund:string;pending:string;abandoned:string;all:string;unpaid:string;expired:string};
export const adminOrderFilterMessages:Record<Locale,Labels>={
 en:{active:"Active / paid",refund:"Refund review",pending:"Pending payment",abandoned:"Abandoned / expired",all:"All",unpaid:"Unpaid — fulfillment is not allowed",expired:"Checkout expired — retained for audit"},
 fr:{active:"Actives / payées",refund:"Remboursements à examiner",pending:"Paiement en attente",abandoned:"Abandonnées / expirées",all:"Toutes",unpaid:"Non payée — aucune exécution autorisée",expired:"Session expirée — conservée pour audit"},
 ku:{active:"چالاک / پارەدراو",refund:"پشکنینی گەڕاندنەوە",pending:"چاوەڕوانی پارەدان",abandoned:"جێهێڵراو / بەسەرچوو",all:"هەموو",unpaid:"پارە نەدراوە — جێبەجێکردن ڕێگەپێدراو نییە",expired:"checkout بەسەرچووە — بۆ audit پارێزراوە"},
 de:{active:"Aktiv / bezahlt",refund:"Erstattungsprüfung",pending:"Zahlung ausstehend",abandoned:"Abgebrochen / abgelaufen",all:"Alle",unpaid:"Unbezahlt — keine Abwicklung zulässig",expired:"Checkout abgelaufen — für Prüfzwecke aufbewahrt"},
 es:{active:"Activos / pagados",refund:"Revisión de reembolsos",pending:"Pago pendiente",abandoned:"Abandonados / vencidos",all:"Todos",unpaid:"Sin pagar — no se permite la preparación",expired:"Pago vencido — conservado para auditoría"},
 it:{active:"Attivi / pagati",refund:"Revisione rimborsi",pending:"Pagamento in attesa",abandoned:"Abbandonati / scaduti",all:"Tutti",unpaid:"Non pagato — evasione non consentita",expired:"Checkout scaduto — conservato per controllo"},
 nl:{active:"Actief / betaald",refund:"Terugbetalingen beoordelen",pending:"Betaling in afwachting",abandoned:"Verlaten / verlopen",all:"Alle",unpaid:"Onbetaald — verwerking niet toegestaan",expired:"Checkout verlopen — bewaard voor controle"},
 pt:{active:"Ativos / pagos",refund:"Revisão de reembolsos",pending:"Pagamento pendente",abandoned:"Abandonados / expirados",all:"Todos",unpaid:"Não pago — processamento não permitido",expired:"Checkout expirado — preservado para auditoria"},
 tr:{active:"Aktif / ödenmiş",refund:"İade incelemesi",pending:"Ödeme bekliyor",abandoned:"Terk edilmiş / süresi dolmuş",all:"Tümü",unpaid:"Ödenmemiş — sipariş işleme alınamaz",expired:"Ödeme oturumu sona erdi — denetim için saklandı"},
 ru:{active:"Активные / оплаченные",refund:"Проверка возвратов",pending:"Ожидают оплаты",abandoned:"Брошенные / истёкшие",all:"Все",unpaid:"Не оплачено — исполнение запрещено",expired:"Сеанс оплаты истёк — сохранён для аудита"},
 ar:{active:"نشطة / مدفوعة",refund:"مراجعة الاسترداد",pending:"بانتظار الدفع",abandoned:"متروكة / منتهية",all:"الكل",unpaid:"غير مدفوعة — لا يُسمح بالتنفيذ",expired:"انتهت جلسة الدفع — محفوظة للتدقيق"},
 fa:{active:"فعال / پرداخت‌شده",refund:"بررسی بازپرداخت",pending:"در انتظار پرداخت",abandoned:"رهاشده / منقضی",all:"همه",unpaid:"پرداخت‌نشده — پردازش مجاز نیست",expired:"تسویه منقضی شد — برای حسابرسی نگهداری می‌شود"},
 hi:{active:"सक्रिय / भुगतान किए गए",refund:"रिफंड समीक्षा",pending:"भुगतान लंबित",abandoned:"छोड़े गए / समाप्त",all:"सभी",unpaid:"भुगतान नहीं हुआ — पूर्ति की अनुमति नहीं",expired:"चेकआउट समाप्त — ऑडिट के लिए सुरक्षित"},
 zh:{active:"有效 / 已付款",refund:"退款审核",pending:"待付款",abandoned:"已放弃 / 已过期",all:"全部",unpaid:"未付款 — 不允许履约",expired:"结账已过期 — 保留用于审计"},
};
