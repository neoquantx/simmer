import React, { useState, useRef } from 'react';
import { saveFromScreenshot } from '../utils/api.js';
import { getSessionId } from '../utils/session.js';

/**
 * ScreenshotUpload Modal
 * Extracts a complete recipe from a screenshot (Instagram, Pinterest, TikTok, blogs)
 * and lets the user preview, edit, and save directly to their Recipe Box.
 */
export default function ScreenshotUpload({ isOpen, onClose, onRecipeSaved }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [extractedRecipe, setExtractedRecipe] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMessage('');
      setExtractedRecipe(null);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setIsLoading(false);
    setErrorMessage('');
    setExtractedRecipe(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleProcessScreenshot = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setErrorMessage('');
    const sessionId = getSessionId();

    try {
      const response = await saveFromScreenshot(selectedFile, sessionId);
      const recipe = response.recipe || response;

      if (recipe && (recipe.title || recipe.name || recipe.ingredients?.length)) {
        setExtractedRecipe({
          id: recipe.id || `screenshot-${Date.now()}`,
          title: recipe.title || recipe.name || 'Saved Screenshot Recipe',
          time: recipe.time || recipe.cook_time || '25 min',
          difficulty: recipe.difficulty || 'Easy',
          ingredients: recipe.ingredients || recipe.used_ingredients || [],
          steps: recipe.steps || [],
          tip: recipe.tip || 'Saved from screenshot',
          source: 'screenshot',
          created_at: new Date().toISOString(),
        });
      } else {
        setErrorMessage("Couldn't read that recipe — try a clearer screenshot with the ingredients and steps visible.");
      }
    } catch (err) {
      console.error('Screenshot processing error:', err);
      setErrorMessage("Couldn't read that recipe — try a clearer screenshot");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSave = () => {
    if (extractedRecipe) {
      onRecipeSaved(extractedRecipe);
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm animate-fadeIn">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="bg-cream-100 rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-charcoal-border flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-charcoal-border">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📱</span>
            <div>
              <h2 className="text-xl font-bold text-charcoal">Save from Screenshot</h2>
              <p className="text-xs text-charcoal-muted">Instagram, TikTok, blog posts, or photos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="touch-target p-2 text-charcoal-muted hover:text-charcoal hover:bg-cream-200 rounded-full transition-colors flex items-center justify-center"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="my-4 flex-1">
          {!previewUrl ? (
            <div className="py-8 px-4 flex flex-col items-center text-center">
              <div className="w-20 h-20 mb-4 rounded-3xl bg-amber-soft flex items-center justify-center text-amber-700 text-3xl shadow-inner">
                📸
              </div>
              <h3 className="font-bold text-lg text-charcoal mb-1">
                Got a recipe saved on your camera roll?
              </h3>
              <p className="text-sm text-charcoal-muted max-w-sm mb-6">
                Upload a screenshot of any recipe. We'll strip out the life stories and ads, giving you just the ingredients and cooking steps.
              </p>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="touch-target w-full py-3.5 px-6 bg-tomato text-white font-bold rounded-xl shadow-md hover:bg-tomato-dark active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>Select recipe screenshot</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* Image Preview */}
              {!extractedRecipe && (
                <div className="relative w-full max-h-64 rounded-xl overflow-hidden bg-black/5 border border-charcoal-border mb-4 flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="Recipe screenshot"
                    className="w-full h-full object-contain max-h-64"
                  />
                  {!isLoading && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="absolute top-2 right-2 bg-charcoal/80 text-white p-1.5 rounded-full hover:bg-charcoal transition-all shadow-md"
                      title="Change photo"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              {/* Loading State */}
              {isLoading && (
                <div className="w-full py-6 px-4 bg-white rounded-xl border border-charcoal-border text-center shadow-sm mb-4">
                  <div className="inline-block animate-spin text-3xl mb-2">📖</div>
                  <p className="font-bold text-charcoal">Reading your recipe...</p>
                  <p className="text-xs text-charcoal-muted mt-1">
                    Extracting ingredients and step-by-step instructions
                  </p>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="w-full p-3.5 mb-3 rounded-xl bg-tomato-soft border border-tomato/30 text-charcoal text-sm flex items-start gap-2">
                  <span className="text-tomato font-bold text-lg leading-tight">⚠️</span>
                  <div className="flex-1">
                    <p className="font-medium text-tomato-dark">{errorMessage}</p>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-xs font-bold text-tomato underline mt-1 hover:text-tomato-dark"
                    >
                      Try another screenshot
                    </button>
                  </div>
                </div>
              )}

              {/* Extracted Recipe Preview / Edit */}
              {extractedRecipe && (
                <div className="w-full bg-white rounded-xl border border-charcoal-border p-4 mb-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-charcoal-border">
                    <span className="text-xs font-bold text-basil uppercase tracking-wider">
                      ✨ Extracted Recipe
                    </span>
                    <span className="text-xs font-semibold text-charcoal-muted">
                      ⏱️ {extractedRecipe.time}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-charcoal-muted uppercase">Recipe Title</label>
                    <input
                      type="text"
                      value={extractedRecipe.title}
                      onChange={(e) =>
                        setExtractedRecipe((prev) => ({ ...prev, title: e.target.value }))
                      }
                      className="w-full font-bold text-lg text-charcoal mt-0.5 p-2 bg-cream-50 rounded-lg border border-charcoal-border focus:bg-white focus:outline-none focus:border-tomato"
                    />
                  </div>

                  {extractedRecipe.ingredients?.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-charcoal-muted uppercase">
                        Ingredients ({extractedRecipe.ingredients.length})
                      </label>
                      <div className="flex flex-wrap gap-1.5 mt-1 max-h-28 overflow-y-auto p-1">
                        {extractedRecipe.ingredients.map((item, i) => (
                          <span
                            key={i}
                            className="bg-basil-soft text-basil-dark text-xs font-semibold px-2.5 py-1 rounded-full border border-basil/20"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {extractedRecipe.steps?.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-charcoal-muted uppercase">
                        Steps ({extractedRecipe.steps.length})
                      </label>
                      <div className="mt-1 space-y-1.5 max-h-36 overflow-y-auto p-1 text-sm text-charcoal">
                        {extractedRecipe.steps.map((st, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="font-bold text-tomato text-xs">{i + 1}.</span>
                            <span className="text-xs leading-relaxed">{st}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="w-full flex gap-2">
                {!extractedRecipe && !isLoading && (
                  <button
                    type="button"
                    onClick={handleProcessScreenshot}
                    className="touch-target flex-1 py-3 px-4 bg-tomato text-white font-bold rounded-xl shadow-md hover:bg-tomato-dark active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Extract Recipe ✨</span>
                  </button>
                )}

                {extractedRecipe && (
                  <button
                    type="button"
                    onClick={handleConfirmSave}
                    className="touch-target flex-1 py-3 px-4 bg-tomato text-white font-bold rounded-xl shadow-md hover:bg-tomato-dark active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Save to Recipe Box 📖</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="touch-target py-3 px-4 bg-white border border-charcoal-border text-charcoal font-semibold rounded-xl hover:bg-cream-50 active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
