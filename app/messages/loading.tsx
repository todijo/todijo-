import LocalizedPageSkeleton from "@/components/LocalizedPageSkeleton";
import LoadingTimeoutNotice from "@/components/LoadingTimeoutNotice";
export default function MessagesLoading() { return <><LocalizedPageSkeleton variant="list"/><LoadingTimeoutNotice route="messages"/></>; }
