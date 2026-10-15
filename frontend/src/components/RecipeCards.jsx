import React, { useState } from 'react';
import RecipeDetail from './RecipeDetail.jsx';

/**
 * RecipeCards displays the 3 suggested dinner options in a vertical stack.
 * Features:
 * - Color-coded left borders: #1 Tomato, #2 Basil, #3 Amber
 * - Accordion expand/collapse on tap
 * - Highlights items from kitchen vs quick buy
 */
export default function RecipeCards({ recipes = [], onCookRecipe, savedIds = [], mealLabel = 'Dinner' }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  if (!recipes || recipes.length === 0) {
    return null;
  }

  const borderColors = [
    'border-l-tomato',
    'border-l-basil',
    'border-l-amber',
  ];

  const tagColors = [
    'text-tomato bg-tomato-soft border-tomato/20',
    'text-basil bg-basil-soft border-basil/20',
    'text-amber-700 bg-amber-soft border-amber/20',
  ];

  const handleToggle = (index) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xl font-black text-charcoal flex items-center gap-2">
          <span>🍽️</span> 3 {mealLabel.toLowerCase()} ideas
        </h3>
        <span className="text-xs font-semibold text-charcoal-muted">
          Tap any card to cook
        </span>
      </div>

      <div className="space-y-4">
        {recipes.map((recipe, index) => {
          const isExpanded = expandedIndex === index;
          const borderColor = borderColors[index % borderColors.length];
          const tagColor = tagColors[index % tagColors.length];
          const recipeId = recipe.id || recipe.recipe_id || `${recipe.name || recipe.title}-${index}`;
          const isSaved = savedIds.includes(recipeId);

          const title = recipe.title || recipe.name || `${mealLabel} option ${index + 1}`;
          const time = recipe.time_min ? `${recipe.time_min} min` : (recipe.time || recipe.cook_time || '20 min');
          const difficulty = recipe.difficulty || 'Easy';
          const usedIngredients = recipe.uses || recipe.used_ingredients || recipe.usedIngredients || recipe.ingredients || [];
          const missingIngredients = recipe.need_to_buy || recipe.missing_ingredients || recipe.missingIngredients || [];

          return (
            <div
              key={recipeId}
              className={`bg-white rounded-2xl border-l-[8px] ${borderColor} shadow-soft hover:shadow-hover border border-charcoal-border/40 transition-all duration-300 overflow-hidden`}
            >
              {isExpanded ? (
                <RecipeDetail
                  recipe={recipe}
                  isSaved={isSaved}
                  onClose={() => setExpandedIndex(null)}
                  onCookIt={(rec) => onCookRecipe && onCookRecipe(rec)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggle(index)}
                  className="w-full text-left p-5 sm:p-6 focus:outline-none focus:bg-cream-50/50 cursor-pointer group"
                  aria-expanded={false}
                >
                  {/* Top line badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${tagColor}`}
                    >
                      Option {index + 1}
                    </span>

                    <div className="flex items-center gap-2 text-xs font-bold text-charcoal-muted">
                      <span className="bg-cream-100 px-2.5 py-1 rounded-full border border-charcoal-border/50">
                        ⏱️ {time}
                      </span>
                      <span className="bg-cream-100 px-2.5 py-1 rounded-full border border-charcoal-border/50">
                        🍳 {difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-xl sm:text-2xl font-black text-charcoal group-hover:text-tomato transition-colors">
                      {title}
                    </h4>
                    <span className="touch-target flex items-center justify-center w-8 h-8 rounded-full bg-cream-100 text-charcoal-muted group-hover:bg-tomato group-hover:text-white transition-all transform group-hover:translate-x-1">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>

                  {/* Ingredients Summary */}
                  <div className="mt-3.5 pt-3.5 border-t border-charcoal-border/40 space-y-2">
                    {/* Uses from kitchen */}
                    <div className="flex items-baseline gap-2 flex-wrap text-sm">
                      <span className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
                        Uses from your kitchen:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {usedIngredients.slice(0, 5).map((ing, i) => (
                          <span
                            key={i}
                            className="bg-basil-soft text-basil-dark text-xs font-semibold px-2 py-0.5 rounded-md"
                          >
                            {ing}
                          </span>
                        ))}
                        {usedIngredients.length > 5 && (
                          <span className="text-xs text-charcoal-muted self-center">
                            +{usedIngredients.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Need to buy */}
                    {missingIngredients.length > 0 && (
                      <div className="flex items-baseline gap-2 flex-wrap text-sm">
                        <span className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
                          Need to buy:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {missingIngredients.map((item, i) => (
                            <span
                              key={i}
                              className="text-xs font-medium text-charcoal bg-cream-200/60 px-2 py-0.5 rounded-md"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
