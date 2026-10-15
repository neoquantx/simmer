import React from 'react';

const CONSTRAINTS = [
  { id: '15-min', label: '⏱️ 15-min only', value: '15-min only' },
  { id: 'spicy', label: '🌶️ Spicy', value: 'Spicy' },
  { id: 'one-pot', label: '🍲 One-pot', value: 'One-pot' },
  { id: 'veg-only', label: '🥬 Veg only', value: 'Veg only' },
];

/**
 * ConstraintChips displays horizontal filter chips for dinner vibes.
 * Single-select toggle: tapping the active chip deselects it.
 */
export default function ConstraintChips({ selectedConstraint, onSelectConstraint }) {
  const handleToggle = (value) => {
    if (selectedConstraint === value) {
      onSelectConstraint(''); // deselect
    } else {
      onSelectConstraint(value);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 -mx-1 scroll-smooth">
        {CONSTRAINTS.map((chip) => {
          const isSelected = selectedConstraint === chip.value;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => handleToggle(chip.value)}
              className={`touch-target flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 active:scale-95 shadow-sm ${
                isSelected
                  ? 'bg-tomato text-white border-2 border-tomato shadow-lift ring-2 ring-tomato/20'
                  : 'bg-white text-charcoal border border-charcoal-border hover:border-tomato/50 hover:bg-cream-50'
              }`}
              aria-pressed={isSelected}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
