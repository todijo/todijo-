import LocalizedPageSkeleton from "@/components/LocalizedPageSkeleton";
import LoadingTimeoutNotice from "@/components/LoadingTimeoutNotice";
export default function SellerProductsLoading() { return <><LocalizedPageSkeleton variant="cards"/><LoadingTimeoutNotice route="seller-products"/></>; }
