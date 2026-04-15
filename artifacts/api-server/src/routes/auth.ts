import { Router, type IRouter } from "express";
import { USERS } from "../data/seed";

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

export default router;
