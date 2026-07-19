"use client";
import { useState } from "react";
import AddToCartButton from "@/components/AddToCartButton";
import type { CartProduct } from "@/components/CartProvider";
export default function ProductPurchasePanel({ product, colors, sizes }: { product: CartProduct; colors: string[]; sizes: string[] }) {
  const colorChoices=colors.length?colors:["Standard"], sizeChoices=sizes.length?sizes:["Unique"];
  const [color,setColor]=useState(colorChoices[0]), [size,setSize]=useState(sizeChoices[0]);
  return <div className="purchasePanel"><div className="optionGroup"><span>Couleur</span><div>{colorChoices.map(v=><button key={v} className={color===v?"selected":""} onClick={()=>setColor(v)} type="button">{v}</button>)}</div></div><div className="optionGroup"><span>Taille / modèle</span><div>{sizeChoices.map(v=><button key={v} className={size===v?"selected":""} onClick={()=>setSize(v)} type="button">{v}</button>)}</div></div><p className="selectedOptions">Sélection : {color} · {size}</p><AddToCartButton product={{...product,selectedOptions:`${color} · ${size}`}} /></div>;
}
