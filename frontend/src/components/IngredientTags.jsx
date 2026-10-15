import React, { useState } from 'react';

/**
 * IngredientTags displays a list of food items as basil-green pills
 * with an intuitive inline add input and tap-friendly removal buttons.
 */
export default function IngredientTags({
  ingredients = [],
  onAdd,
  onRemove,
  placeholder = 'Add another item...',
  colorScheme = 'basil', // 'basil' for ingredients, 'charcoal' or 'tomato' for dislikes
}) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      if (onAdd) {
        onAdd(trimmed);
      }
      setInputValue('');
    }
  };

  // Tag styling based on colorScheme
  const isBasil = colorScheme === 'basil';
  const tagClass = isBasil
    ? 'bg-basil text-white border-basil-dark shadow-sm hover:bg-basil-dark'
    : 'bg-white text-charcoal border-charcoal-border hover:border-tomato hover:text-tomato shadow-sm';

  const badgeIconClass = isBasil
    ? 'text-white/80 hover:text-white hover:bg-black/15'
    : 'text-charcoal-muted hover:text-tomato hover:bg-tomato-soft';

  return (
    <div className="w-full">
      {/* Existing Tags Pill Container */}
      <div className="flex flex-wrap gap-2 items-center">
        {ingredients.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 transform active:scale-95 animate-fadeIn border ${tagClass}`}
          >
            <span>{item}</span>
            <button
              type="button"
              onClick={() => onRemove && onRemove(item)}
              className={`p-1 rounded-full transition-colors flex items-center justify-center -mr-1 focus:outline-none ${badgeIconClass}`}
              aria-label={`Remove ${item}`}
              title={`Remove ${item}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3.5 h-3.5 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </span>
        ))}

        {/* Inline Quick Add Input */}
        <div className="inline-flex items-center gap-1 flex-1 min-w-[140px] max-w-[240px]">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={ingredients.length === 0 ? placeholder : '+ add more...'}
            className="w-full px-3 py-1.5 text-sm bg-white/70 border border-charcoal-border rounded-full focus:bg-white focus:outline-none focus:border-tomato focus:ring-1 focus:ring-tomato text-charcoal placeholder-charcoal-light transition-all"
          />
          {inputValue.trim() && (
            <button
              type="button"
              onClick={handleSubmit}
              className="touch-target px-3 py-1.5 bg-tomato text-white text-xs font-bold rounded-full hover:bg-tomato-dark active:scale-95 transition-all shadow-sm flex items-center justify-center"
              aria-label="Add item"
            >
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
