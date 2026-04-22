import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import leadsRouter from "./leads";
import estimatingRouter from "./estimating";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(projectsRouter);
router.use(dashboardRouter);
router.use(aiRouter);
router.use(leadsRouter);
router.use(estimatingRouter);

export default router;
