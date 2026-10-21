import { Router } from 'express';
import { listTasks, createTask, updateTask } from './taskController';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listTasks);
router.post('/', createTask);
router.patch('/:id', updateTask);

export default router;
