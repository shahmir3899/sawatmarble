import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma";
import type { Role } from "../generated/prisma/enums";

// Must run after requireAuth (needs req.user set). This is the primary
// authorization gate — the backend's DB connection uses a role that
// bypasses RLS, so RLS policies on the tables are defense-in-depth only,
// not the real enforcement for requests that go through this API.
export function requireRole(...allowedRoles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const profile = await prisma.profile.findUnique({ where: { id: req.user.id } });
    if (!profile) {
      return res.status(403).json({ error: "No profile found for this user" });
    }

    if (!allowedRoles.includes(profile.role)) {
      return res.status(403).json({ error: "Insufficient role" });
    }

    next();
  };
}
