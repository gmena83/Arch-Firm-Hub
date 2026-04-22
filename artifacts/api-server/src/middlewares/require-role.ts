import type { Request, Response, NextFunction } from "express";
import { USERS } from "../data/seed";

type Role = "admin" | "architect" | "client" | "superadmin" | "team";

export type AuthedRequest = Request & { user?: typeof USERS[number] };

// Demo token format: `demo-token-${user.id}-${timestamp}`
export function userFromAuthHeader(req: Request): typeof USERS[number] | undefined {
  const header = req.headers["authorization"];
  if (typeof header !== "string") return undefined;
  const match = /^Bearer\s+demo-token-(user-[^\s-]+(?:-[^\s-]+)*?)-\d+$/.exec(header);
  if (!match) return undefined;
  const userId = match[1];
  return USERS.find((u) => u.id === userId);
}

// Map "team" role alias to all internal team-member roles.
function expandRoles(roles: Role[]): Role[] {
  const expanded = new Set<Role>(roles);
  if (expanded.has("team")) {
    expanded.add("admin");
    expanded.add("architect");
    expanded.add("superadmin");
  }
  return Array.from(expanded);
}

export function requireRole(roles: Role[] | Role, ..._rest: Role[]) {
  const roleList = expandRoles(Array.isArray(roles) ? roles : [roles, ..._rest]);
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = userFromAuthHeader(req);
    if (!user) {
      res.status(401).json({ error: "unauthorized", message: "Authentication required" });
      return;
    }
    if (!roleList.includes(user.role as Role)) {
      res.status(403).json({ error: "forbidden", message: "Insufficient permissions" });
      return;
    }
    (req as AuthedRequest).user = user;
    next();
  };
}
