import { Router } from 'express';
import {
  listHabits,
  getAnalytics,
  getCalendar,
  createNewHabit,
  patchHabit,
  toggleHabit,
  verifyLeetCode,
  removeHabit,
} from '../controllers/habit.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', listHabits);
router.get('/analytics', getAnalytics);
router.get('/calendar', getCalendar);
router.post('/', createNewHabit);
router.patch('/:id', patchHabit);
router.post('/:id/toggle', toggleHabit);
router.post('/:id/verify-leetcode', verifyLeetCode);
router.delete('/:id', removeHabit);

export default router;