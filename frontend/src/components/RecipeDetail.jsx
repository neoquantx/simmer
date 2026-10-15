import React, { useState } from 'react';

/**
 * RecipeDetail: Full expanded recipe view optimized for cooking at the stove.
 * Big readable steps (18px+), ingredient check-offs, stove tip, and "Cook it! 🍳" action.
 */
export default function RecipeDetail({
  recipe,
  onClose,
  onCookIt,
  isSaved = false,
}) {
  const [checkedItems, setCheckedItems] = useState({});
  const [cookedSuccess, setCookedSuccess] = useState(false);

  if (!recipe) return null;

  const title = recipe.title || recipe.name || 'Delicious Dinner';
  const time = recipe.time_min ? `${recipe.time_min} min` : (recipe.time || recipe.cook_time || '20 min');
  const difficulty = recipe.difficulty || 'Easy';
  const usedIngredients = recipe.uses || recipe.used_ingredients || recipe.usedIngredients || recipe.ingredients || [];
  const missingIngredients = recipe.need_to_buy || recipe.missing_ingredients || recipe.missingIngredients || [];
  const steps = recipe.steps || [];
  const tip = recipe.tip || recipe.notes || 'Taste before salting — cheese and sauces already pack plenty of punch!';

  const toggleCheck = (item) => {
    setCheckedItems((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  const handleCook = () => {
    setCookedSuccess(true);
    if (onCookIt) {
      onCookIt(recipe);
    }
    setTimeout(() => {
      setCookedSuccess(false);
    }, 2800);
  };

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-soft border border-charcoal-border animate-fadeIn">
      {/* Top action row */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <button
          type="button"
          onClick={onClose}
          className="touch-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cream hover:bg-cream-200 text-charcoal text-sm font-semibold transition-colors"
          aria-label="Collapse recipe"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to ideas</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-cream-200 text-charcoal rounded-full text-xs font-bold">
            ⏱️ {time}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-cream-200 text-charcoal rounded-full text-xs font-bold">
            🍳 {difficulty}
          </span>
        </div>
      </div>

      {/* Recipe Title */}
      <h2 className="text-2xl sm:text-3xl font-extrabold text-charcoal tracking-tight mb-4">
        {title}
      </h2>

      {/* What You'll Use Section */}
      <div className="mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-charcoal-muted mb-2.5">
          What you'll use from your kitchen
        </h3>
        {usedIngredients.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {usedIngredients.map((item, idx) => (
              <span
                key={idx}
                className="bg-basil-soft text-basil-dark border border-basil/20 font-semibold px-3 py-1 rounded-full text-sm inline-flex items-center gap-1"
              >
                <span>✓</span>
                <span>{item}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-charcoal-muted italic">Pantry staples</p>
        )}
      </div>

      {/* Quick Shopping List (Missing ingredients) */}
      {missingIngredients.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-soft border border-amber/30">
          <h3 className="text-sm font-bold uppercase tracking-wider text-charcoal mb-2 flex items-center gap-1.5">
            <span>🛒</span> Quick shopping list (tap to cross off)
          </h3>
          <ul className="space-y-2 mt-2">
            {missingIngredients.map((item, idx) => {
              const isChecked = !!checkedItems[item];
              return (
                <li key={idx} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => toggleCheck(item)}
                    className="touch-target flex items-center gap-2.5 text-left text-sm group cursor-pointer"
                  >
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                        isChecked
                          ? 'bg-basil border-basil text-white'
                          : 'bg-white border-charcoal-light group-hover:border-tomato'
                      }`}
                    >
                      {isChecked && (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </span>
                    <span
                      className={`font-medium transition-colors ${
                        isChecked ? 'line-through text-charcoal-light' : 'text-charcoal'
                      }`}
                    >
                      {item}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Numbered Steps: Big readable text (18px+) for stove reading */}
      <div className="mb-6">
        <h3 className="text-base font-extrabold text-charcoal mb-3 flex items-center gap-2">
          <span>👩‍🍳</span> Cooking Steps
        </h3>
        <div className="space-y-4">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3.5 p-3.5 rounded-xl bg-cream-50 hover:bg-cream-100 transition-colors border border-charcoal-border/50"
            >
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-tomato text-white font-extrabold text-base flex items-center justify-center shadow-sm">
                {idx + 1}
              </span>
              <p className="text-[18px] sm:text-[19px] leading-relaxed font-medium text-charcoal pt-0.5">
                {step}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Stove Tip */}
      {tip && (
        <div className="mb-6 p-4 rounded-xl bg-cream-200 border-l-4 border-tomato">
          <div className="flex items-start gap-2.5">
            <span className="text-xl">💡</span>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
                Kitchen Friend Tip
              </h4>
              <p className="text-sm font-semibold text-charcoal mt-0.5">{tip}</p>
            </div>
          </div>
        </div>
      )}

      {/* Cook it Button & Feedback */}
      <div className="pt-2 border-t border-charcoal-border flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          onClick={handleCook}
          className={`touch-target w-full sm:flex-1 py-4 px-6 rounded-xl font-bold text-lg text-white shadow-lift transition-all transform active:scale-95 flex items-center justify-center gap-2 ${
            cookedSuccess ? 'bg-basil' : 'bg-tomato hover:bg-tomato-dark'
          }`}
        >
          {cookedSuccess ? (
            <>
              <span>🎉</span>
              <span>Saved to Recipe Box! Bon appétit!</span>
            </>
          ) : (
            <>
              <span>🍳</span>
              <span>{isSaved ? 'Cook it again! 🍳' : 'Cook it! 🍳 (Save to Box)'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="touch-target w-full sm:w-auto py-3.5 px-5 rounded-xl border border-charcoal-border bg-white text-charcoal font-bold hover:bg-cream-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
