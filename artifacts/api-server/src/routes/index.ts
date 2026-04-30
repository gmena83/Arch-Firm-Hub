import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import leadsRouter from "./leads";
import estimatingRouter from "./estimating";
import notificationsRouter from "./notifications";
import contractorsRouter from "./contractors";
import auditRouter from "./audit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(projectsRouter);
router.use(dashboardRouter);
router.use(aiRouter);
router.use(leadsRouter);
router.use(estimatingRouter);
router.use(notificationsRouter);
router.use(contractorsRouter);
router.use(auditRouter);

export default router;
