import { Router } from 'express';
import {
  listHabits,
  createNewHabit,
  toggleHabit,
  verifyLeetCode,
  removeHabit,
} from '../controllers/habit.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', listHabits);
router.post('/', createNewHabit);
router.post('/:id/toggle', toggleHabit);
router.post('/:id/verify-leetcode', verifyLeetCode);
router.delete('/:id', removeHabit);

export default router;