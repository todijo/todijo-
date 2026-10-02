import { TeamPermission, TeamRoleTemplate } from "@prisma/client";

export const teamSeatLimit = 3;

const templates: Record<TeamRoleTemplate, readonly TeamPermission[]> = {
  STORE_MANAGER: [
    "PRODUCT_VIEW","PRODUCT_CREATE","PRODUCT_EDIT_CONTENT","PRODUCT_CHANGE_PRICE","PRODUCT_CHANGE_STOCK","PRODUCT_MANAGE_VARIANTS","PRODUCT_ADD_MEDIA","PRODUCT_REMOVE_MEDIA","PRODUCT_PUBLISH",
    "ORDER_VIEW","ORDER_FULFILL","ORDER_UPDATE_TRACKING","ORDER_UPDATE_STATUS","MESSAGE_VIEW","MESSAGE_REPLY",
    "STORE_VIEW_SETTINGS","STORE_EDIT_DESCRIPTION","STORE_EDIT_MEDIA","STORE_EDIT_SETTINGS","STORE_EDIT_SHIPPING","ANALYTICS_VIEW","SALES_VIEW",
  ],
  ORDER_MANAGER: ["ORDER_VIEW","ORDER_FULFILL","ORDER_UPDATE_TRACKING","ORDER_UPDATE_STATUS","MESSAGE_VIEW","MESSAGE_REPLY","SALES_VIEW"],
  PRODUCT_MANAGER: ["PRODUCT_VIEW","PRODUCT_CREATE","PRODUCT_EDIT_CONTENT","PRODUCT_CHANGE_PRICE","PRODUCT_CHANGE_STOCK","PRODUCT_MANAGE_VARIANTS","PRODUCT_ADD_MEDIA","PRODUCT_REMOVE_MEDIA","PRODUCT_PUBLISH","ANALYTICS_VIEW"],
  CUSTOMER_SUPPORT: ["ORDER_VIEW","MESSAGE_VIEW","MESSAGE_REPLY"],
  CUSTOM: [],
};

export const teamPermissions = Object.values(TeamPermission);
export const teamRoleTemplates = Object.values(TeamRoleTemplate);

export function permissionsForTemplate(template: TeamRoleTemplate) {
  return [...templates[template]];
}

export function parseTeamRoleTemplate(value: unknown): TeamRoleTemplate | null {
  return typeof value === "string" && teamRoleTemplates.includes(value as TeamRoleTemplate) ? value as TeamRoleTemplate : null;
}

export function parseTeamPermissions(value: unknown): TeamPermission[] | null {
  if (!Array.isArray(value)) return null;
  const unique = [...new Set(value)];
  return unique.every((item): item is TeamPermission => typeof item === "string" && teamPermissions.includes(item as TeamPermission)) ? unique : null;
}

export function resolvedTeamPermissions(template: TeamRoleTemplate, custom: unknown) {
  const parsed = parseTeamPermissions(custom);
  if (parsed === null) return null;
  return template === "CUSTOM" || parsed.length ? parsed : permissionsForTemplate(template);
}
