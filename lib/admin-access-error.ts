export class AdminAccessError extends Error {
  constructor(message: string, public status = 400, public code = "ADMIN_ACCESS_ERROR") { super(message); }
}
