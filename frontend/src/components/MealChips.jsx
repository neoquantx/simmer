import React from 'react';
import { MEALS } from '../utils/meals.js';

export default function MealChips({ selectedMeal, onSelectMeal }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {MEALS.map((meal) => {
        const isSelected = selectedMeal === meal.id;
        return (
          <button
            key={meal.id}
            type="button"
            onClick={() => onSelectMeal(meal.id)}
            aria-pressed={isSelected}
            className={`touch-target px-2 py-2.5 rounded-2xl text-sm font-black transition-all active:scale-95 ${
              isSelected
                ? 'bg-tomato text-white shadow-lift'
                : 'bg-white text-charcoal border border-charcoal-border hover:border-tomato/50'
            }`}
          >
            {meal.label}
          </button>
        );
      })}
    </div>
  );
}
