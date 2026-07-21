"use client";

import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";

export default function ClearPaidCart() {
  const { clearCart } = useCart();
  useEffect(() => { clearCart(); }, []); // Clear only after the server-rendered page confirms PAID.
  return null;
}
