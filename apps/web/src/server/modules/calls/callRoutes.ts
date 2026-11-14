import { Router } from 'express';
import { logCall, getCallLogsByLead } from './callController';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/lead/:leadId', logCall);
router.get('/lead/:leadId', getCallLogsByLead);

export default router;
