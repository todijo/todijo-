"use client";

import { useMemo, useState } from "react";
import { DESKTOP_CATEGORY_TAXONOMY, resolveCanonicalLeafSelection, subcategoryId } from "@/lib/desktop-category-taxonomy";

type Labels={main:string;group:string;leaf:string;chooseMain:string;chooseGroup:string;chooseLeaf:string;legacyInvalid:string};

export default function SellerCategorySelector({initialValue="",labels,required=true}:{initialValue?:string;labels:Labels;required?:boolean}){
  const initial=useMemo(()=>resolveCanonicalLeafSelection(initialValue),[initialValue]);
  const[categoryId,setCategoryId]=useState(initial?.categoryId??"");
  const[groupId,setGroupId]=useState(initial?.groupId??"");
  const[leafId,setLeafId]=useState(initial?.id??"");
  const category=DESKTOP_CATEGORY_TAXONOMY.find(item=>item.id===categoryId);
  const group=category?.groups.find(item=>item.id===groupId);
  const invalidLegacy=Boolean(initialValue&&!initial);
  return <div className="sellerCategorySelector">
    <div className="sellerCategoryLevel"><label htmlFor="category-main">{labels.main}</label><select id="category-main" value={categoryId} required={required} onChange={event=>{setCategoryId(event.target.value);setGroupId("");setLeafId("")}}><option value="" disabled>{labels.chooseMain}</option>{DESKTOP_CATEGORY_TAXONOMY.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
    <div className="sellerCategoryLevel"><label htmlFor="category-group">{labels.group}</label><select id="category-group" value={groupId} required={required} disabled={!category} onChange={event=>{setGroupId(event.target.value);setLeafId("")}}><option value="" disabled>{labels.chooseGroup}</option>{category?.groups.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
    <div className="sellerCategoryLevel"><label htmlFor="category">{labels.leaf}</label><select id="category" name="category" value={leafId} required={required} disabled={!group} onChange={event=>setLeafId(event.target.value)}><option value="" disabled>{labels.chooseLeaf}</option>{group?.items.map(label=>{const id=subcategoryId(categoryId,groupId,label);return <option key={id} value={id}>{label}</option>})}</select></div>
    {invalidLegacy&&<p className="sellerCategoryLegacyWarning" role="alert">{labels.legacyInvalid}</p>}
  </div>
}
