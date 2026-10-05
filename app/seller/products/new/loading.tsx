import LocalizedPageSkeleton from "@/components/LocalizedPageSkeleton";
import LoadingTimeoutNotice from "@/components/LoadingTimeoutNotice";
export default function NewProductLoading() { return <><LocalizedPageSkeleton variant="form"/><LoadingTimeoutNotice route="seller-product-new"/></>; }
