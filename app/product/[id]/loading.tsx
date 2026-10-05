import LocalizedPageSkeleton from "@/components/LocalizedPageSkeleton";
import LoadingTimeoutNotice from "@/components/LoadingTimeoutNotice";
export default function ProductLoading() { return <><div className="productDetailLoadingSkeleton"><LocalizedPageSkeleton variant="detail"/></div><LoadingTimeoutNotice route="product-detail"/></>; }
