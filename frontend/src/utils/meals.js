export const MEALS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'snack', label: 'Snacks' },
  { id: 'dinner', label: 'Dinner' },
];

export function mealForHour(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 18) return 'snack';
  if (hour >= 18 && hour < 22) return 'dinner';
  return 'snack';
}

export function mealLabel(mealId) {
  return MEALS.find((meal) => meal.id === mealId)?.label || 'Dinner';
}

export function mealQuestion(mealId) {
  if (mealId === 'snack') return 'a snack';
  return mealLabel(mealId).toLowerCase();
}
