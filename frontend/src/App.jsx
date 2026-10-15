import React, { useState, useEffect } from 'react';
import Home from './components/Home.jsx';
import RecipeBox from './components/RecipeBox.jsx';
import { getRecipeBox, deleteRecipe, checkHealth } from './utils/api.js';
import { getSessionId } from './utils/session.js';

const STORAGE_SAVED_KEY = 'simmer_local_saved_recipes';

/**
 * Main app container for the Simmer PWA.
 * Manages view switching between Home and Recipe Box, persistent offline recipes,
 * and bottom navigation.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'box'
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const sessionId = getSessionId();

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch initial recipe box on mount
  useEffect(() => {
    let isMounted = true;

    async function fetchSaved() {
      // First load local storage cache for instant render
      try {
        const cached = localStorage.getItem(STORAGE_SAVED_KEY);
        if (cached && isMounted) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setSavedRecipes(parsed);
          }
        }
      } catch (err) {
        console.warn('LocalStorage read error:', err);
      }

      // Then sync from server
      try {
        const data = await getRecipeBox(sessionId);
        const serverList = data.recipes || (Array.isArray(data) ? data : []);
        if (isMounted && serverList.length > 0) {
          setSavedRecipes(serverList);
          localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(serverList));
        }
      } catch (err) {
        console.warn('Server recipe box sync not available:', err.message);
      }
    }

    fetchSaved();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  // Save recipe handler (from Cook It or Screenshot upload)
  const handleSaveRecipe = (recipe) => {
    const recipeId = recipe.id || `recipe-${Date.now()}`;
    const normalized = {
      ...recipe,
      id: recipeId,
      title: recipe.title || recipe.name || 'Delicious Dinner',
      saved_at: new Date().toISOString(),
    };

    setSavedRecipes((prev) => {
      // Avoid duplicate by id or title
      const exists = prev.some((r) => r.id === recipeId || r.title === normalized.title);
      if (exists) {
        return prev;
      }
      const updated = [normalized, ...prev];
      try {
        localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Delete recipe handler
  const handleDeleteRecipe = async (recipeId) => {
    setSavedRecipes((prev) => {
      const updated = prev.filter((r) => r.id !== recipeId);
      try {
        localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      await deleteRecipe(recipeId, sessionId);
    } catch (err) {
      console.warn('Could not delete on remote server, updated locally:', err.message);
    }
  };

  const savedRecipeIds = savedRecipes.map((r) => r.id);

  return (
    <div className="min-h-screen bg-cream flex flex-col font-sans selection:bg-tomato selection:text-white">
      {/* Offline banner if disconnected */}
      {!isOnline && (
        <div className="bg-charcoal text-cream text-xs font-bold text-center py-1.5 px-4 sticky top-0 z-50 flex items-center justify-center gap-1.5 shadow-sm">
          <span>📡</span>
          <span>Offline mode active. Your saved recipes are always ready!</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-4 sm:pt-6">
        {activeTab === 'home' && (
          <Home
            onCookRecipe={handleSaveRecipe}
            savedRecipeIds={savedRecipeIds}
          />
        )}

        {activeTab === 'box' && (
          <RecipeBox
            recipes={savedRecipes}
            onDeleteRecipe={handleDeleteRecipe}
            onSaveRecipe={handleSaveRecipe}
            onCookRecipe={handleSaveRecipe}
          />
        )}

        {/* Privacy tagline at bottom */}
        <footer className="text-center py-6 mt-auto">
          <p className="text-xs font-bold text-charcoal-muted tracking-wide flex items-center justify-center gap-1.5 opacity-80">
            <span>Your fridge stays your business.</span>
            <span>🔒</span>
          </p>
          <p className="text-[11px] text-charcoal-light mt-0.5">
            Zero accounts. Zero tracking. Just dinner.
          </p>
        </footer>
      </main>

      {/* Mobile-First Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-charcoal-border pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.04)]"
        aria-label="Main Navigation"
      >
        <div className="max-w-md mx-auto flex items-center justify-around h-16 px-6">
          {/* Home Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`touch-target flex-1 flex flex-col items-center justify-center py-1 font-bold text-xs transition-all ${
              activeTab === 'home'
                ? 'text-tomato scale-105'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
            aria-selected={activeTab === 'home'}
          >
            <div className="relative">
              <span className="text-2xl leading-none">🏠</span>
              {activeTab === 'home' && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-1 bg-tomato rounded-full" />
              )}
            </div>
            <span className="mt-1">Home</span>
          </button>

          {/* Recipe Box Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('box');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`touch-target flex-1 flex flex-col items-center justify-center py-1 font-bold text-xs transition-all ${
              activeTab === 'box'
                ? 'text-tomato scale-105'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
            aria-selected={activeTab === 'box'}
          >
            <div className="relative">
              <span className="text-2xl leading-none">📖</span>
              {savedRecipes.length > 0 && (
                <span className="absolute -top-1 -right-2.5 px-1.5 min-w-[18px] h-[18px] bg-tomato text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm">
                  {savedRecipes.length}
                </span>
              )}
              {activeTab === 'box' && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-1 bg-tomato rounded-full" />
              )}
            </div>
            <span className="mt-1">Recipe Box</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
