import React, { useState, useEffect, useRef } from 'react';
import IngredientTags from './IngredientTags.jsx';
import ConstraintChips from './ConstraintChips.jsx';
import PhotoCapture from './PhotoCapture.jsx';
import RecipeCards from './RecipeCards.jsx';
import { suggestRecipes, getPantry, savePantry } from '../utils/api.js';
import { getSessionId } from '../utils/session.js';

const EXAMPLE_INGREDIENTS = ['eggs', 'rice', 'spinach', 'chicken', 'tomato', 'onion'];

const LOADING_MESSAGES = [
  'Cooking up 3 doable dinners...',
  'Checking what goes great together...',
  'Zero fancy kitchen gear required...',
  'Finding recipes that fit your evening...',
];

/**
 * Home View:
 * What's for dinner screen with fridge snap, ingredient tags, dislikes, constraints,
 * and 3 doable suggestions.
 */
export default function Home({ onCookRecipe, savedRecipeIds = [] }) {
  const [ingredients, setIngredients] = useState([]);
  const [dislikes, setDislikes] = useState([]);
  const [selectedConstraint, setSelectedConstraint] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  const inputRef = useRef(null);
  const recipesSectionRef = useRef(null);

  // Load pantry on mount
  useEffect(() => {
    let isMounted = true;
    const sessionId = getSessionId();

    async function loadPantryData() {
      try {
        const data = await getPantry(sessionId);
        if (isMounted && data) {
          if (Array.isArray(data.ingredients) && data.ingredients.length > 0) {
            setIngredients(data.ingredients);
          }
          if (Array.isArray(data.dislikes) && data.dislikes.length > 0) {
            setDislikes(data.dislikes);
          }
        }
      } catch (err) {
        console.warn('Could not prefill pantry from API, using clean slate:', err.message);
      }
    }

    loadPantryData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Cycle loading messages during API call
  useEffect(() => {
    let timer;
    if (isLoading) {
      timer = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000);
    } else {
      setLoadingMsgIndex(0);
    }
    return () => clearInterval(timer);
  }, [isLoading]);

  // Handle adding an ingredient
  const handleAddIngredient = (item) => {
    const clean = item.trim().toLowerCase();
    if (clean && !ingredients.includes(clean)) {
      const updated = [...ingredients, clean];
      setIngredients(updated);
      setFeedbackError('');
      // Save pantry in background
      savePantry(getSessionId(), updated, dislikes).catch(() => {});
    }
  };

  // Handle removing an ingredient
  const handleRemoveIngredient = (item) => {
    const updated = ingredients.filter((i) => i !== item);
    setIngredients(updated);
    savePantry(getSessionId(), updated, dislikes).catch(() => {});
  };

  // Handle adding a dislike
  const handleAddDislike = (item) => {
    const clean = item.trim().toLowerCase();
    if (clean && !dislikes.includes(clean)) {
      const updated = [...dislikes, clean];
      setDislikes(updated);
      savePantry(getSessionId(), ingredients, updated).catch(() => {});
    }
  };

  // Handle removing a dislike
  const handleRemoveDislike = (item) => {
    const updated = dislikes.filter((i) => i !== item);
    setDislikes(updated);
    savePantry(getSessionId(), ingredients, updated).catch(() => {});
  };

  // Handle ingredients detected from photo
  const handleIngredientsFromPhoto = (detectedList) => {
    const merged = Array.from(new Set([...ingredients, ...detectedList.map((i) => i.toLowerCase().trim())]));
    setIngredients(merged);
    setFeedbackError('');
    savePantry(getSessionId(), merged, dislikes).catch(() => {});
  };

  // Handle submitting the text input directly
  const handleTextInputSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      // Split by comma if user typed multiple ingredients like "eggs, rice, tomato"
      const items = inputText
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const merged = Array.from(new Set([...ingredients, ...items]));
      setIngredients(merged);
      setInputText('');
      setFeedbackError('');
      savePantry(getSessionId(), merged, dislikes).catch(() => {});
    }
  };

  // Focus input helper
  const handleFocusInput = () => {
    inputRef.current?.focus();
  };

  // Main Suggest action
  const handleFeedMeRecipes = async () => {
    if (ingredients.length === 0 && !inputText.trim()) {
      setFeedbackError('Add a couple of ingredients you have at home first! 🍅');
      handleFocusInput();
      return;
    }

    let finalIngredients = [...ingredients];
    if (inputText.trim()) {
      const items = inputText
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      finalIngredients = Array.from(new Set([...ingredients, ...items]));
      setIngredients(finalIngredients);
      setInputText('');
    }

    setIsLoading(true);
    setFeedbackError('');

    const sessionId = getSessionId();

    try {
      const result = await suggestRecipes(
        finalIngredients,
        dislikes,
        selectedConstraint,
        sessionId
      );

      const returnedRecipes = result.recipes || result.suggestions || (Array.isArray(result) ? result : []);

      if (returnedRecipes.length > 0) {
        setRecipes(returnedRecipes);
        // Gently scroll to recipes
        setTimeout(() => {
          recipesSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      } else {
        setFeedbackError("Couldn't find matches for this combination right now. Try adding a staple like eggs or rice!");
      }
    } catch (err) {
      console.error('Suggest recipes failed:', err);
      // If server unreachable or error, provide 3 warm fallback recipes so the user is never stuck
      const mockFallbackRecipes = [
        {
          id: `fallback-1-${Date.now()}`,
          title: `Crispy ${finalIngredients[0] || 'Egg'} Skillet Rice`,
          time: '18 min',
          difficulty: 'Easy',
          used_ingredients: finalIngredients.slice(0, 3),
          missing_ingredients: ['Butter', 'Soy sauce'],
          steps: [
            'Heat a large skillet over medium-high heat with a spoonful of butter or oil.',
            `Toss in your ${finalIngredients[0] || 'veggies and aromatics'} and sauté for 3-4 minutes until fragrant.`,
            'Add cooked rice (or noodles) and press it flat against the pan to get those delicious crispy bottom bits.',
            'Drizzle with soy sauce or your favorite seasoning and top with a fried egg.',
          ],
          tip: 'Letting the rice sit untouched for 2 full minutes creates the best golden crust.',
        },
        {
          id: `fallback-2-${Date.now()}`,
          title: 'Comforting 15-Minute Kitchen Scramble',
          time: '15 min',
          difficulty: 'Easy',
          used_ingredients: finalIngredients.slice(0, 4),
          missing_ingredients: ['Pinch of black pepper'],
          steps: [
            'Whisk eggs with a splash of milk or water and a pinch of salt.',
            'Sauté chopped ingredients in a non-stick pan until tender.',
            'Pour eggs gently over the mix and stir in slow, soft folds on low heat.',
            'Serve immediately with warm toast or tortillas.',
          ],
          tip: 'Take the pan off the heat just before the eggs look completely set — carryover cooking does the rest.',
        },
        {
          id: `fallback-3-${Date.now()}`,
          title: 'Cozy One-Pan Pantry Toss',
          time: '22 min',
          difficulty: 'Easy',
          used_ingredients: finalIngredients,
          missing_ingredients: ['Olive oil', 'Garlic powder'],
          steps: [
            'Warm olive oil in a skillet with minced garlic or garlic powder.',
            'Add harder ingredients first, letting them soften and brown.',
            'Season with whatever warm spices you love — cumin, paprika, or Italian herbs.',
            'Finish with a squeeze of lemon or grated cheese.',
          ],
          tip: 'A splash of vinegar or citrus at the end wakes up the entire dish.',
        },
      ];
      setRecipes(mockFallbackRecipes);
      setTimeout(() => {
        recipesSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-24">
      {/* App Warm Greeting Header */}
      <header className="text-center pt-2 pb-1">
        <div className="inline-flex items-center justify-center gap-2 mb-1">
          <span className="text-3xl">🍲</span>
          <h1 className="text-4xl font-black text-charcoal tracking-tight font-sans">
            Simmer
          </h1>
        </div>
        <p className="text-base font-semibold text-charcoal-muted">
          What's for dinner? Snap your fridge, get 3 doable recipes.
        </p>
      </header>

      {/* Primary Input Card */}
      <section className="bg-white rounded-3xl p-5 sm:p-7 shadow-soft border border-charcoal-border/70 space-y-5">
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-charcoal-muted mb-2">
            What do you have?
          </label>

          {/* Quick Dual Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(true)}
              className="touch-target py-3 px-3 sm:px-4 bg-tomato-soft border-2 border-tomato/40 text-tomato font-black text-sm sm:text-base rounded-2xl hover:bg-tomato-soft/80 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <span className="text-lg">📷</span>
              <span>Snap your fridge</span>
            </button>

            <button
              type="button"
              onClick={handleFocusInput}
              className="touch-target py-3 px-3 sm:px-4 bg-cream-50 border border-charcoal-border text-charcoal font-bold text-sm sm:text-base rounded-2xl hover:border-charcoal-light active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <span className="text-lg">⌨️</span>
              <span>Type ingredients</span>
            </button>
          </div>

          {/* Freeform Text Input */}
          <form onSubmit={handleTextInputSubmit} className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="eggs, rice, spinach..."
              className="w-full pl-4 pr-24 py-3.5 bg-cream-50/70 border-2 border-charcoal-border rounded-2xl text-base text-charcoal placeholder-charcoal-light focus:bg-white focus:outline-none focus:border-tomato focus:ring-2 focus:ring-tomato/20 transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="touch-target absolute right-2 px-4 py-2 bg-charcoal text-white text-xs font-extrabold rounded-xl hover:bg-tomato active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              Add
            </button>
          </form>
        </div>

        {/* Current Ingredient Tags */}
        {ingredients.length > 0 ? (
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-charcoal-muted">
                In your kitchen ({ingredients.length}):
              </span>
              <button
                type="button"
                onClick={() => {
                  setIngredients([]);
                  savePantry(getSessionId(), [], dislikes).catch(() => {});
                }}
                className="text-xs text-charcoal-muted hover:text-tomato underline font-semibold"
              >
                Clear all
              </button>
            </div>
            <IngredientTags
              ingredients={ingredients}
              onAdd={handleAddIngredient}
              onRemove={handleRemoveIngredient}
              placeholder="Add another item..."
              colorScheme="basil"
            />
          </div>
        ) : (
          /* Empty state prompt with tap-to-add starter chips */
          <div className="py-2 px-1">
            <p className="text-xs font-bold text-charcoal-muted mb-2">
              Tap any pantry staples to add:
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_INGREDIENTS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleAddIngredient(item)}
                  className="touch-target px-3 py-1.5 rounded-full text-xs font-bold bg-cream-200/80 hover:bg-basil hover:text-white text-charcoal border border-charcoal-border/50 transition-all active:scale-95 flex items-center gap-1"
                >
                  <span>+</span>
                  <span>{item}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dislikes / Don't like Section */}
        <div className="pt-3 border-t border-charcoal-border/50">
          <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-muted mb-2">
            I don't like / Avoid:
          </label>
          <IngredientTags
            ingredients={dislikes}
            onAdd={handleAddDislike}
            onRemove={handleRemoveDislike}
            placeholder="e.g. cilantro, mushrooms..."
            colorScheme="charcoal"
          />
        </div>

        {/* Constraint Filter Chips */}
        <div className="pt-3 border-t border-charcoal-border/50">
          <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-muted mb-2">
            Dinner Vibe:
          </label>
          <ConstraintChips
            selectedConstraint={selectedConstraint}
            onSelectConstraint={setSelectedConstraint}
          />
        </div>

        {/* Friendly Error Notice */}
        {feedbackError && (
          <div className="p-3 bg-tomato-soft border border-tomato/30 rounded-xl text-tomato-dark text-sm font-semibold flex items-center gap-2">
            <span>💡</span>
            <span>{feedbackError}</span>
          </div>
        )}

        {/* Big Tomato CTA Button */}
        <button
          type="button"
          onClick={handleFeedMeRecipes}
          disabled={isLoading}
          className="touch-target w-full py-4 px-6 bg-tomato hover:bg-tomato-dark active:scale-[0.98] text-white font-black text-lg rounded-2xl shadow-lift transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-wait"
        >
          {isLoading ? (
            <>
              <span className="animate-spin text-xl">🍳</span>
              <span>Cooking up ideas...</span>
            </>
          ) : (
            <>
              <span>Feed me recipes</span>
              <span>🍳</span>
            </>
          )}
        </button>
      </section>

      {/* Loading State Animation */}
      {isLoading && (
        <div className="bg-white rounded-3xl p-8 shadow-soft border border-charcoal-border/70 text-center space-y-4 animate-fadeIn">
          <div className="relative w-20 h-20 mx-auto">
            <div className="w-20 h-20 rounded-full bg-cream-200 flex items-center justify-center text-4xl animate-bounce">
              🍳
            </div>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1">
              <span className="w-2 h-2 rounded-full bg-tomato animate-ping" />
              <span className="w-2 h-2 rounded-full bg-basil animate-ping delay-150" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-black text-charcoal">
              {LOADING_MESSAGES[loadingMsgIndex]}
            </h3>
            <p className="text-sm font-semibold text-charcoal-muted mt-1">
              Zero judgment, pure kitchen friendliness.
            </p>
          </div>
        </div>
      )}

      {/* Recipes Section */}
      <div ref={recipesSectionRef}>
        {!isLoading && recipes.length > 0 && (
          <RecipeCards
            recipes={recipes}
            onCookRecipe={onCookRecipe}
            savedIds={savedRecipeIds}
          />
        )}
      </div>

      {/* Fridge Photo Capture Modal */}
      <PhotoCapture
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        onIngredientsDetected={handleIngredientsFromPhoto}
      />
    </div>
  );
}
