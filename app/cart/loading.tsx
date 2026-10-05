import LocalizedPageSkeleton from "@/components/LocalizedPageSkeleton";
import LoadingTimeoutNotice from "@/components/LoadingTimeoutNotice";
export default function CartLoading() { return <><LocalizedPageSkeleton variant="list"/><LoadingTimeoutNotice route="cart"/></>; }
