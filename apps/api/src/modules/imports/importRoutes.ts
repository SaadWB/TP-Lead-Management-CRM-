import { Router } from 'express';
import { parseUploadedFile, validateAndReviewImport, commitImport, upload } from './importController';
import { authenticate, requireRole } from '../../middleware/auth';
import { USER_ROLES } from '@crm/shared';

const router = Router();

router.use(authenticate);
router.use(requireRole([USER_ROLES.SUPER_ADMIN]));

router.post('/upload', upload.single('file'), parseUploadedFile);
router.post('/validate', validateAndReviewImport);
router.post('/commit', commitImport);

export default router;
