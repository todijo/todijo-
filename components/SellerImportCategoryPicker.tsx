"use client";

import { useMemo, useState } from "react";
import { locales } from "@/i18n/config";
import { DESKTOP_CATEGORY_TAXONOMY, canonicalLeafCategory, subcategoryId } from "@/lib/desktop-category-taxonomy";
import { localizedCategoryGroupLabel, localizedCategoryLeafLabel } from "@/lib/category-tree-localization";
import { localizedSellerImportMainCategory, localizedSellerImportOtherCategory } from "@/lib/seller-import-category-labels";
import { normalizeSellerImportCategoryText } from "@/lib/seller-import-category-suggestions";
import { sellerImportCategoryRootId, sellerImportOtherCategoryId, sellerImportOtherParent } from "@/lib/seller-import-category";

export type SellerImportCategoryPickerLabels = {
  searchCategories: string; mainCategory: string; chooseMainCategory: string; subcategory: string;
  chooseSubcategory: string; noSubcategory: string; categoryPath: string; other: string;
};

export default function SellerImportCategoryPicker({ value, onChange, locale, labels, id }: {
  value: string; onChange: (value: string) => void; locale: string; labels: SellerImportCategoryPickerLabels; id: string;
}) {
  const [query, setQuery] = useState("");
  const selectedLeaf = canonicalLeafCategory(value);
  const selectedOtherParent = sellerImportOtherParent(value);
  const selectedMain = sellerImportCategoryRootId(value) ?? "";
  const selectedOther = Boolean(selectedOtherParent);
  const category = DESKTOP_CATEGORY_TAXONOMY.find(item => item.id === selectedMain);
  const normalizedQuery = normalizeSellerImportCategoryText(query);
  const visibleCategories = useMemo(() => DESKTOP_CATEGORY_TAXONOMY.filter(item => {
    if (item.id === selectedMain || !normalizedQuery) return true;
    const mainLabel = localizedSellerImportMainCategory(locale, item.id);
    const aliases = [item.id, item.slug, item.label, mainLabel, ...item.legacyValues, ...locales.map(candidate => localizedSellerImportMainCategory(candidate, item.id))];
    const children = item.groups.flatMap(group => [group.label, ...locales.map(candidate => localizedCategoryGroupLabel(candidate, item.id, group.id, group.label)), ...group.items, ...group.items.flatMap(leaf => locales.map(candidate => localizedCategoryLeafLabel(candidate, item.id, group.id, leaf)))]);
    children.push(localizedSellerImportOtherCategory(locale));
    return [...aliases, ...children].some(alias => normalizeSellerImportCategoryText(alias).includes(normalizedQuery));
  }), [locale, normalizedQuery, selectedMain]);
  const visibleSubcategories = category?.groups.flatMap(group => group.items.map(leaf => {
    const idValue = subcategoryId(category.id, group.id, leaf);
    const groupLabel = localizedCategoryGroupLabel(locale, category.id, group.id, group.label);
    const leafLabel = localizedCategoryLeafLabel(locale, category.id, group.id, leaf);
    return { id: idValue, label: leafLabel, path: `${groupLabel} › ${leafLabel}`, aliases: [idValue, leaf, leafLabel, group.label, groupLabel] };
  })).filter(item => {
    if (!normalizedQuery) return true;
    const rootAliases = [category.label, ...locales.map(candidate => localizedSellerImportMainCategory(candidate, category.id)), ...category.legacyValues];
    if (rootAliases.some(alias => normalizeSellerImportCategoryText(alias).includes(normalizedQuery))) return true;
    return item.id === selectedLeaf?.id || item.aliases.some(alias => normalizeSellerImportCategoryText(alias).includes(normalizedQuery)) || category.groups.some(group => group.items.some(leaf => item.id === subcategoryId(category.id, group.id, leaf) && locales.some(candidate => normalizeSellerImportCategoryText(localizedCategoryLeafLabel(candidate, category.id, group.id, leaf)).includes(normalizedQuery))));
  }) ?? [];
  const selectedPath = selectedOther && selectedOtherParent ? `${localizedSellerImportMainCategory(locale, selectedOtherParent)} › ${localizedSellerImportOtherCategory(locale)}` : selectedLeaf ? `${localizedSellerImportMainCategory(locale, selectedLeaf.categoryId)} › ${localizedCategoryGroupLabel(locale, selectedLeaf.categoryId, selectedLeaf.groupId, selectedLeaf.groupLabel)} › ${localizedCategoryLeafLabel(locale, selectedLeaf.categoryId, selectedLeaf.groupId, selectedLeaf.label)}` : category ? localizedSellerImportMainCategory(locale, category.id) : "";

  return <div className="sellerImportCategoryPicker" id={id}>
    <label className="sellerImportCategorySearch">{labels.searchCategories}<input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={labels.searchCategories} autoComplete="off" /></label>
    <label>{labels.mainCategory}<select value={selectedMain} onChange={event => onChange(event.target.value)} aria-label={labels.mainCategory}>
      <option value="">{labels.chooseMainCategory}</option>
      {visibleCategories.map(item => <option key={item.id} value={item.id}>{localizedSellerImportMainCategory(locale, item.id)}</option>)}
    </select></label>
    <label>{labels.subcategory}<select value={selectedOther ? value : selectedLeaf?.id ?? ""} disabled={!category} onChange={event => onChange(event.target.value || selectedMain)} aria-label={labels.subcategory}>
      <option value="">{category ? labels.chooseSubcategory : labels.noSubcategory}</option>
      {category && <optgroup label={labels.other}><option value={sellerImportOtherCategoryId(category.id)}>{labels.other}</option></optgroup>}
      {category?.groups.map(group => {
        const options = visibleSubcategories.filter(item => item.id.startsWith(`${category.id}--${group.id}--`));
        return options.length ? <optgroup key={group.id} label={localizedCategoryGroupLabel(locale, category.id, group.id, group.label)}>{options.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup> : null;
      })}
    </select></label>
    {selectedPath && <p className="sellerImportCategoryPath"><span>{labels.categoryPath}: </span><bdi>{selectedPath}</bdi></p>}
  </div>;
}
