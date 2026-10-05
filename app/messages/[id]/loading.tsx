import LocalizedPageSkeleton from "@/components/LocalizedPageSkeleton";
import LoadingTimeoutNotice from "@/components/LoadingTimeoutNotice";
export default function ConversationLoading() { return <><LocalizedPageSkeleton variant="detail"/><LoadingTimeoutNotice route="message-detail"/></>; }
