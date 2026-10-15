import React, { useState, useEffect } from 'react';
import Home from './components/Home.jsx';
import RecipeBox from './components/RecipeBox.jsx';
import Landing from './components/Landing.jsx';
import YearlyOffer from './components/YearlyOffer.jsx';
import { getRecipeBox, deleteRecipe, getSession, markEntered } from './utils/api.js';
import { setSessionId } from './utils/session.js';

/**
 * Main app container for the Simmer PWA.
 * Manages view switching between Home and Recipe Box, persistent offline recipes,
 * and bottom navigation.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'box'
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showLanding, setShowLanding] = useState(true);
  const [freeUsesRemaining, setFreeUsesRemaining] = useState(3);
  const [showOffer, setShowOffer] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionId, setSessionIdState] = useState('');

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

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const data = await getSession();
        if (!isMounted) return;
        setSessionId(data.session_id);
        setSessionIdState(data.session_id);
        setShowLanding(!data.entered);
        setFreeUsesRemaining(data.free_uses_remaining);
      } catch (err) {
        console.warn('Session load failed:', err.message);
      } finally {
        if (isMounted) setSessionReady(true);
      }
    }

    loadSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch the recipe box once the session id is known
  useEffect(() => {
    if (!sessionId) return undefined;
    let isMounted = true;

    async function fetchSaved() {
      try {
        const data = await getRecipeBox(sessionId);
        const serverList = data.recipes || (Array.isArray(data) ? data : []);
        if (isMounted) {
          setSavedRecipes(serverList);
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
      return [normalized, ...prev];
    });
  };

  // Delete recipe handler
  const handleDeleteRecipe = async (recipeId) => {
    setSavedRecipes((prev) => prev.filter((r) => r.id !== recipeId));

    try {
      await deleteRecipe(recipeId, sessionId);
    } catch (err) {
      console.warn('Could not delete on remote server, updated locally:', err.message);
    }
  };

  const savedRecipeIds = savedRecipes.map((r) => r.id);

  const enterKitchen = async () => {
    try {
      const data = await markEntered();
      setSessionId(data.session_id);
      setSessionIdState(data.session_id);
      setFreeUsesRemaining(data.free_uses_remaining);
    } catch (err) {
      console.warn('Could not save kitchen entry:', err.message);
    }
    setShowLanding(false);
  };

  const handleSuggestionUsed = (remaining) => {
    if (typeof remaining === 'number') {
      setFreeUsesRemaining(remaining);
    }
  };

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center font-sans">
        <p className="text-sm font-bold text-charcoal-muted">Opening the kitchen…</p>
      </div>
    );
  }

  if (showLanding) {
    return <Landing onEnter={enterKitchen} />;
  }

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
            freeUsesRemaining={freeUsesRemaining}
            onNeedSubscription={() => setShowOffer(true)}
            onSuggestionUsed={handleSuggestionUsed}
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
            Zero accounts. The next meal, from what you already have.
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

      {showOffer && (
        <YearlyOffer
          onClose={() => setShowOffer(false)}
          onViewSaved={() => {
            setShowOffer(false);
            setActiveTab('box');
          }}
        />
      )}
    </div>
  );
}
