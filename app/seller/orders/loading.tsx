import LocalizedPageSkeleton from "@/components/LocalizedPageSkeleton";
import LoadingTimeoutNotice from "@/components/LoadingTimeoutNotice";
export default function SellerOrdersLoading() { return <><LocalizedPageSkeleton variant="list"/><LoadingTimeoutNotice route="seller-orders"/></>; }
