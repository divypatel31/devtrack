import { Router } from 'express';
import {
  listHabits,
  createNewHabit,
  toggleHabit,
  removeHabit,
} from '../controllers/habit.controller';

const router = Router();

router.get('/', listHabits);
router.post('/', createNewHabit);
router.post('/:id/toggle', toggleHabit);
router.delete('/:id', removeHabit);

export default router;