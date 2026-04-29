import { Router, type IRouter } from "express";
import { USERS, PROJECTS, appendActivity } from "../data/seed";
import { userFromAuthHeader } from "../middlewares/require-role";

const router: IRouter = Router();

router.post("/auth/login", (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user) {
    res.status(401).json({ error: "unauthorized", message: "Invalid email or password" });
    return;
  }

  const { password: _pw, ...safeUser } = user;

  res.json({
    token: `demo-token-${user.id}-${Date.now()}`,
    user: safeUser,
  });
});

// Refresh the authenticated user (used by the dashboard after PATCH /me to
// re-hydrate localStorage with the latest contact fields).
router.get("/me", (req, res) => {
  const user = userFromAuthHeader(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }
  const { password: _pw, ...safeUser } = user;
  res.json(safeUser);
});

// Update the authenticated user's editable contact fields. For client users
// every owned project receives a `profile_update` activity entry so the team
// can see the change in the project timeline (T5 audit prep).
router.patch("/me", (req, res) => {
  const user = userFromAuthHeader(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;

  const updates: { phone?: string; postalAddress?: string; physicalAddress?: string } = {};
  const changedKeys: string[] = [];
  const trim = (raw: unknown): string | undefined => (typeof raw === "string" ? raw.trim() : undefined);

  const phone = trim(body["phone"]);
  if (phone !== undefined) updates.phone = phone;
  const postalAddress = trim(body["postalAddress"]);
  if (postalAddress !== undefined) updates.postalAddress = postalAddress;
  const physicalAddress = trim(body["physicalAddress"]);
  if (physicalAddress !== undefined) updates.physicalAddress = physicalAddress;

  for (const key of ["phone", "postalAddress", "physicalAddress"] as const) {
    if (updates[key] !== undefined && updates[key] !== user[key]) {
      user[key] = updates[key];
      changedKeys.push(key);
    }
  }

  if (changedKeys.length > 0 && user.role === "client") {
    const labelEn: Record<string, string> = {
      phone: "phone",
      postalAddress: "postal address",
      physicalAddress: "physical address",
    };
    const labelEs: Record<string, string> = {
      phone: "teléfono",
      postalAddress: "dirección postal",
      physicalAddress: "dirección física",
    };
    const fieldsEn = changedKeys.map((k) => labelEn[k]).join(", ");
    const fieldsEs = changedKeys.map((k) => labelEs[k]).join(", ");
    for (const project of PROJECTS as Array<{ id: string; clientUserId?: string }>) {
      if (project.clientUserId === user.id) {
        appendActivity(project.id, {
          type: "profile_update",
          actor: user.name,
          description: `Client updated their ${fieldsEn}.`,
          descriptionEs: `El cliente actualizó su ${fieldsEs}.`,
        });
      }
    }
  }

  const { password: _pw, ...safeUser } = user;
  res.json(safeUser);
});

export default router;
