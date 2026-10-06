"use client";

import { useMemo, useState } from "react";
import { permissionsForTemplate, teamPermissions, teamRoleTemplates } from "@/lib/seller-team-permissions";
import type { SellerTeamCopy } from "@/i18n/seller-team";
import { CANONICAL_LEAF_CATEGORIES } from "@/lib/desktop-category-taxonomy";

type Store = { id: string; name: string };
type Scope = { productScope: "ALL_PRODUCTS" | "SELECTED_CATEGORIES"; categoryKeys: string[] };
type Member = { id: string; status: string; roleTemplate: string; permissions: string[]; user: { firstName: string; lastName: string; email: string; hasPassword: boolean }; assignments: ({ storeId: string } & Scope)[] };
type Invitation = { id: string; email: string; roleTemplate: string; expiresAt: string; revokedAt: string | null; stores: ({ storeId: string } & Scope)[] };
type AccessDraft = { roleTemplate: string; permissions: string[]; storeIds: string[]; productScopes: Record<string, Scope> };

function permissionGroups() {
  return teamPermissions.reduce<Record<string, typeof teamPermissions>>((groups, permission) => {
    const group = permission.split("_")[0];
    groups[group] = [...(groups[group] ?? []), permission];
    return groups;
  }, {});
}

function AccessFields({ copy, stores, draft, onChange }: { copy: SellerTeamCopy; stores: Store[]; draft: AccessDraft; onChange: (next: AccessDraft) => void }) {
  const groups = useMemo(permissionGroups, []);
  const toggleStore = (storeId: string) => onChange({ ...draft, storeIds: draft.storeIds.includes(storeId) ? draft.storeIds.filter((id) => id !== storeId) : [...draft.storeIds, storeId], productScopes: { ...draft.productScopes, [storeId]: draft.productScopes[storeId] ?? { productScope: "ALL_PRODUCTS", categoryKeys: [] } } });
  const updateScope = (storeId: string, scope: Scope) => onChange({ ...draft, productScopes: { ...draft.productScopes, [storeId]: scope } });
  const togglePermission = (permission: string) => onChange({ ...draft, permissions: draft.permissions.includes(permission) ? draft.permissions.filter((item) => item !== permission) : [...draft.permissions, permission] });
  const chooseRole = (roleTemplate: string) => onChange({ ...draft, roleTemplate, permissions: permissionsForTemplate(roleTemplate as Parameters<typeof permissionsForTemplate>[0]) });
  return <>
    <fieldset><legend>{copy.stores}</legend><p>{copy.storeHelp}</p>{stores.map((store) => {const scope=draft.productScopes[store.id]??{productScope:"ALL_PRODUCTS" as const,categoryKeys:[]};return <div key={store.id}><label><input type="checkbox" checked={draft.storeIds.includes(store.id)} onChange={() => toggleStore(store.id)}/>{store.name}</label>{draft.storeIds.includes(store.id)&&<div className="sellerTeamProductScope"><label>{copy.productAccess}<select value={scope.productScope} onChange={event=>updateScope(store.id,{productScope:event.target.value as Scope["productScope"],categoryKeys:event.target.value==="ALL_PRODUCTS"?[]:scope.categoryKeys})}><option value="ALL_PRODUCTS">{copy.allProducts}</option><option value="SELECTED_CATEGORIES">{copy.selectedCategories}</option></select></label>{scope.productScope==="SELECTED_CATEGORIES"&&<label>{copy.allowedCategories}<select multiple size={6} value={scope.categoryKeys} onChange={event=>updateScope(store.id,{...scope,categoryKeys:Array.from(event.currentTarget.selectedOptions,option=>option.value)})}>{CANONICAL_LEAF_CATEGORIES.map(category=><option key={category.id} value={category.id}>{category.label}</option>)}</select></label>}</div>}</div>})}</fieldset>
    <label>{copy.role}<select value={draft.roleTemplate} onChange={(event) => chooseRole(event.target.value)}>{teamRoleTemplates.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select><small>{copy.roleHelp}</small></label>
    <fieldset><legend>{copy.permissions}</legend>{Object.entries(groups).map(([group, items]) => <div className="sellerPermissionGroup" key={group}><strong>{group}</strong>{items.map((permission) => <label key={permission}><input type="checkbox" checked={draft.permissions.includes(permission)} onChange={() => togglePermission(permission)}/><span>{permission.replaceAll("_", " ")}</span></label>)}</div>)}</fieldset>
  </>;
}

export default function TeamManagement({ locale, copy, stores, members, invitations }: { locale: string; copy: SellerTeamCopy; stores: Store[]; members: Member[]; invitations: Invitation[] }) {
  const initialDraft = { roleTemplate: "STORE_MANAGER", permissions: permissionsForTemplate("STORE_MANAGER"), storeIds: stores[0] ? [stores[0].id] : [], productScopes: Object.fromEntries(stores.map(store=>[store.id,{productScope:"ALL_PRODUCTS" as const,categoryKeys:[]}])) };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteDraft, setInviteDraft] = useState<AccessDraft>(initialDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [memberDraft, setMemberDraft] = useState<AccessDraft>(initialDraft);

  async function invite(form: FormData) {
    setBusy(true); setError("");
    const response = await fetch("/api/seller/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), locale, roleTemplate: inviteDraft.roleTemplate, permissions: inviteDraft.permissions, storeIds: inviteDraft.storeIds, productScopes: inviteDraft.productScopes }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(body.error ?? "TEAM_REQUEST_FAILED"); return; }
    location.reload();
  }

  async function memberAction(id: string, action: string) {
    const confirmation = action === "remove" ? copy.confirmRemove : action === "suspend" ? copy.confirmSuspend : "";
    if (confirmation && !confirm(confirmation)) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/seller/team/members/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(body.error ?? "TEAM_UPDATE_FAILED"); return; }
    location.reload();
  }

  function edit(member: Member) {
    setEditing(member.id);
    setMemberDraft({ roleTemplate: member.roleTemplate, permissions: member.permissions, storeIds: member.assignments.map((item) => item.storeId), productScopes: Object.fromEntries(member.assignments.map(item=>[item.storeId,{productScope:item.productScope,categoryKeys:item.categoryKeys}])) });
  }

  async function saveMember(memberId: string) {
    setBusy(true); setError("");
    const response = await fetch(`/api/seller/team/members/${memberId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "permissions", ...memberDraft }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(body.error ?? "TEAM_UPDATE_FAILED"); return; }
    location.reload();
  }

  async function setMemberPassword(member: Member, form: FormData) {
    setBusy(true); setError("");
    const response=await fetch(`/api/seller/team/members/${member.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"password",newPassword:form.get("newPassword")})});
    const body=await response.json().catch(()=>({}));setBusy(false);
    if(!response.ok){setError(body.error??"TEAM_UPDATE_FAILED");return;}
    location.reload();
  }

  async function invitationAction(id: string, action: "revoke" | "resend") {
    if (action === "revoke" && !confirm(`${copy.revoke}?`)) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/seller/team/invitations/${id}`, { method: action === "revoke" ? "DELETE" : "POST" });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(body.error ?? "INVITATION_UPDATE_FAILED"); return; }
    location.reload();
  }

  return <div className="sellerTeamGrid" aria-busy={busy}>
    <section className="sellerTeamCard"><h2>{copy.invite}</h2><p>{copy.invitationHelp}</p><form action={invite} className="sellerTeamForm"><label>{copy.email}<input type="email" name="email" required maxLength={320}/></label><AccessFields copy={copy} stores={stores} draft={inviteDraft} onChange={setInviteDraft}/>{error && <p role="alert">{error}</p>}<button disabled={busy || !inviteDraft.storeIds.length}>{copy.invite}</button></form></section>
    <section className="sellerTeamCard"><h2>{copy.title}</h2>{!members.length && !invitations.length && <p>{copy.empty}</p>}
      {members.map((member) => <article className="sellerTeamMember" key={member.id}><div><strong>{member.user.firstName} {member.user.lastName}</strong><span>{member.user.email}</span></div><span className={`premiumStatusBadge status-${member.status.toLowerCase()}`}>{copy[member.status.toLowerCase() as "active" | "suspended" | "removed"] ?? member.status}</span><small>{member.roleTemplate.replaceAll("_", " ")} · {member.assignments.map((item) => {const store=stores.find((entry)=>entry.id===item.storeId)?.name??"";const scope=item.productScope==="ALL_PRODUCTS"?copy.allProducts:`${copy.allowedCategories}: ${item.categoryKeys.map(id=>CANONICAL_LEAF_CATEGORIES.find(category=>category.id===id)?.label??id).join(", ")}`;return `${store} · ${copy.productAccess}: ${scope}`}).join(" · ")}</small>
        {editing === member.id ? <div className="sellerTeamForm sellerTeamAccessEditor"><AccessFields copy={copy} stores={stores} draft={memberDraft} onChange={setMemberDraft}/><div><button type="button" disabled={busy || !memberDraft.storeIds.length} onClick={() => saveMember(member.id)}>{copy.save}</button><button type="button" onClick={() => setEditing(null)}>{copy.cancel}</button></div></div> : <div>{member.status !== "REMOVED" && <button type="button" onClick={() => edit(member)}>{copy.edit}</button>}{member.status === "ACTIVE" && <button type="button" onClick={() => memberAction(member.id, "suspend")}>{copy.suspend}</button>}{member.status === "SUSPENDED" && <button type="button" onClick={() => memberAction(member.id, "reactivate")}>{copy.reactivate}</button>}{member.status !== "REMOVED" && <button className="danger" type="button" onClick={() => memberAction(member.id, "remove")}>{copy.remove}</button>}</div>}
        {member.status!=="REMOVED"&&<form action={(form)=>setMemberPassword(member,form)} className="sellerTeamPasswordForm">{member.user.hasPassword&&<p>{copy.replacePasswordWarning}</p>}<label>{member.user.hasPassword?copy.replacePassword:copy.setPassword}<input type="password" name="newPassword" autoComplete="new-password" minLength={10} maxLength={1024} required/></label><button type="submit" disabled={busy}>{member.user.hasPassword?copy.replacePassword:copy.setPassword}</button></form>}
      </article>)}
      {invitations.map((invitation) => <article className="sellerTeamMember" key={invitation.id}><div><strong>{invitation.email}</strong><small>{copy.expires}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(invitation.expiresAt))}</small><small>{invitation.stores.map(item=>`${stores.find(store=>store.id===item.storeId)?.name??""} · ${item.productScope==="ALL_PRODUCTS"?copy.allProducts:`${copy.allowedCategories}: ${item.categoryKeys.map(id=>CANONICAL_LEAF_CATEGORIES.find(category=>category.id===id)?.label??id).join(", ")}`}`).join(" · ")}</small></div><span className={`premiumStatusBadge status-${invitation.revokedAt ? "removed" : "pending"}`}>{invitation.revokedAt ? copy.removed : copy.pending}</span>{!invitation.revokedAt && <div><button disabled={busy} type="button" onClick={() => invitationAction(invitation.id, "resend")}>{copy.resend}</button><button disabled={busy} type="button" onClick={() => invitationAction(invitation.id, "revoke")}>{copy.revoke}</button></div>}</article>)}
      {error && <p role="alert">{error}</p>}
    </section>
  </div>;
}
