import React, { useState } from 'react';
import RecipeDetail from './RecipeDetail.jsx';
import ScreenshotUpload from './ScreenshotUpload.jsx';

/**
 * RecipeBox Component
 * Displays user's saved recipes (both cooked/favorited recipes and extracted screenshots).
 * Includes quick delete confirmation, accordion detail views, and a FAB to upload screenshots.
 */
export default function RecipeBox({
  recipes = [],
  onDeleteRecipe,
  onSaveRecipe,
  onCookRecipe,
}) {
  const [selectedRecipeId, setSelectedRecipeId] = useState(null);
  const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState(null);

  const handleToggleExpand = (id) => {
    setSelectedRecipeId((prev) => (prev === id ? null : id));
  };

  const handleConfirmDelete = () => {
    if (recipeToDelete && onDeleteRecipe) {
      onDeleteRecipe(recipeToDelete.id);
      if (selectedRecipeId === recipeToDelete.id) {
        setSelectedRecipeId(null);
      }
    }
    setRecipeToDelete(null);
  };

  const handleRecipeSavedFromModal = (newRecipe) => {
    if (onSaveRecipe) {
      onSaveRecipe(newRecipe);
    }
    setIsScreenshotModalOpen(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto pb-24 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-1">
        <div>
          <h1 className="text-3xl font-black text-charcoal flex items-center gap-2">
            <span>Recipe Box</span>
            <span className="text-2xl">📖</span>
          </h1>
          <p className="text-sm font-semibold text-charcoal-muted mt-0.5">
            {recipes.length === 0
              ? 'No saved recipes yet'
              : `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'} saved`}
          </p>
        </div>

        {/* Top Add Button */}
        <button
          type="button"
          onClick={() => setIsScreenshotModalOpen(true)}
          className="touch-target px-4 py-2 bg-tomato text-white text-sm font-bold rounded-full shadow-soft hover:bg-tomato-dark active:scale-95 transition-all flex items-center gap-1.5"
        >
          <span>+</span>
          <span className="hidden sm:inline">Add from</span>
          <span>screenshot</span>
        </button>
      </div>

      {/* Recipe List or Empty State */}
      {recipes.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-charcoal-border shadow-soft my-6">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-cream-200 flex items-center justify-center text-4xl shadow-inner">
            📚
          </div>
          <h2 className="text-xl font-bold text-charcoal mb-2">
            Your recipe box is waiting!
          </h2>
          <p className="text-charcoal-muted text-sm max-w-sm mx-auto mb-6">
            Save a dinner idea, or snap a recipe screenshot to keep it here.
          </p>

          <button
            type="button"
            onClick={() => setIsScreenshotModalOpen(true)}
            className="touch-target inline-flex items-center gap-2 px-6 py-3.5 bg-tomato text-white font-bold rounded-2xl shadow-lift hover:bg-tomato-dark active:scale-95 transition-all"
          >
            <span>📱</span>
            <span>+ Add from screenshot</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {recipes.map((recipe) => {
            const isExpanded = selectedRecipeId === recipe.id;
            const ingredientCount =
              (recipe.ingredients && recipe.ingredients.length) ||
              (recipe.used_ingredients && recipe.used_ingredients.length) ||
              0;
            const isScreenshot = recipe.source === 'screenshot';

            return (
              <div
                key={recipe.id}
                className="bg-white rounded-2xl border border-charcoal-border/50 shadow-soft overflow-hidden transition-all duration-200"
              >
                {isExpanded ? (
                  <RecipeDetail
                    recipe={recipe}
                    isSaved={true}
                    onClose={() => setSelectedRecipeId(null)}
                    onCookIt={(rec) => onCookRecipe && onCookRecipe(rec)}
                  />
                ) : (
                  <div className="p-5 flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleExpand(recipe.id)}
                      className="flex-1 text-left focus:outline-none group cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {isScreenshot ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-soft text-amber-800 border border-amber/30">
                            📱 Screenshot
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-basil-soft text-basil-dark border border-basil/30">
                            🍳 Kitchen Pick
                          </span>
                        )}
                        <span className="text-xs font-semibold text-charcoal-muted">
                          ⏱️ {recipe.time || '20 min'}
                        </span>
                        <span className="text-xs font-semibold text-charcoal-muted">
                          🥗 {ingredientCount} ingredients
                        </span>
                      </div>

                      <h2 className="text-lg sm:text-xl font-bold text-charcoal group-hover:text-tomato transition-colors">
                        {recipe.title || recipe.name}
                      </h2>
                    </button>

                    {/* Delete Icon Button */}
                    <button
                      type="button"
                      onClick={() => setRecipeToDelete(recipe)}
                      className="touch-target p-2 text-charcoal-muted hover:text-tomato hover:bg-tomato-soft rounded-full transition-colors flex items-center justify-center -mr-2"
                      title="Remove from Recipe Box"
                      aria-label={`Delete ${recipe.title}`}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button for mobile quick upload */}
      <div className="fixed bottom-20 right-5 z-40 sm:hidden">
        <button
          type="button"
          onClick={() => setIsScreenshotModalOpen(true)}
          className="touch-target w-14 h-14 rounded-full bg-tomato text-white shadow-lift flex items-center justify-center hover:bg-tomato-dark active:scale-90 transition-transform"
          aria-label="Add from screenshot"
        >
          <span className="text-2xl font-bold">+</span>
        </button>
      </div>

      {/* Screenshot Upload Modal */}
      <ScreenshotUpload
        isOpen={isScreenshotModalOpen}
        onClose={() => setIsScreenshotModalOpen(false)}
        onRecipeSaved={handleRecipeSavedFromModal}
      />

      {/* Delete Confirmation Dialog */}
      {recipeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-charcoal-border text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-tomato-soft text-tomato flex items-center justify-center text-xl font-bold">
              🗑️
            </div>
            <h2 className="text-lg font-bold text-charcoal mb-1">Remove recipe?</h2>
            <p className="text-sm text-charcoal-muted mb-6">
              Remove <span className="font-semibold text-charcoal">"{recipeToDelete.title || recipeToDelete.name}"</span> from your Recipe Box?
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="touch-target flex-1 py-3 px-4 bg-tomato text-white font-bold rounded-xl hover:bg-tomato-dark active:scale-95 transition-all"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setRecipeToDelete(null)}
                className="touch-target flex-1 py-3 px-4 bg-cream-100 border border-charcoal-border text-charcoal font-semibold rounded-xl hover:bg-cream-200 active:scale-95 transition-all"
              >
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
