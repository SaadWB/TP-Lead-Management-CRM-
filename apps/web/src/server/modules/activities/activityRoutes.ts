import { Router, Request, Response, NextFunction } from 'express';
import { activityRepository } from '../../repositories/activityRepository';
import { authenticate } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

const router = Router();

router.use(authenticate);

router.get('/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
    const activities = await activityRepository.findRecent(limit);
    sendSuccess(res, activities);
  } catch (err) {
    next(err);
  }
});

router.get('/lead/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activities = await activityRepository.findByLeadId(req.params.leadId);
    sendSuccess(res, activities);
  } catch (err) {
    next(err);
  }
});

export default router;
