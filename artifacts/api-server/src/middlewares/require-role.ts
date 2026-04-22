import type { Request, Response, NextFunction } from "express";
import { USERS } from "../data/seed";

type Role = "admin" | "architect" | "client" | "superadmin";

// Demo token format: `demo-token-${user.id}-${timestamp}`
function userFromAuthHeader(req: Request): typeof USERS[number] | undefined {
  const header = req.headers["authorization"];
  if (typeof header !== "string") return undefined;
  const match = /^Bearer\s+demo-token-(user-[^\s-]+(?:-[^\s-]+)*?)-\d+$/.exec(header);
  if (!match) return undefined;
  const userId = match[1];
  return USERS.find((u) => u.id === userId);
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = userFromAuthHeader(req);
    if (!user) {
      res.status(401).json({ error: "unauthorized", message: "Authentication required" });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: "forbidden", message: "Insufficient permissions" });
      return;
    }
    next();
  };
}
