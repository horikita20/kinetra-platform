import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionRouter from "./session";
import videoRouter from "./video";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionRouter);
router.use(videoRouter);

export default router;
