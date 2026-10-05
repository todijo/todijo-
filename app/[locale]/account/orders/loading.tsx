import LocalizedPageSkeleton from "@/components/LocalizedPageSkeleton";
import LoadingTimeoutNotice from "@/components/LoadingTimeoutNotice";
export default function OrdersLoading() { return <><LocalizedPageSkeleton variant="list"/><LoadingTimeoutNotice route="account-orders"/></>; }
