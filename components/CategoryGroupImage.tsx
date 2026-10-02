"use client";

import Image from "next/image";
import { useState } from "react";
import { categoryGroupImagePath } from "../lib/category-group-artwork";

export default function CategoryGroupImage({ categoryId, groupId }: { categoryId: string; groupId: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const src = categoryGroupImagePath(categoryId, groupId, failedSrc);
  if (!src) return null;
  return <Image src={src} alt="" aria-hidden="true" width={40} height={40}
    style={{ display: "inline-block", verticalAlign: "middle", marginInlineEnd: 8, borderRadius: 8, objectFit: "cover" }}
    onError={() => setFailedSrc(src)} />;
}
