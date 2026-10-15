import React, { useState, useRef } from 'react';
import { getIngredientsFromPhoto } from '../utils/api.js';
import { getSessionId } from '../utils/session.js';

/**
 * PhotoCapture Modal
 * Allows snapping a picture with the device camera or picking from camera roll.
 * Sends the image to /api/ingredients-from-photo and returns detected items.
 */
export default function PhotoCapture({ isOpen, onClose, onIngredientsDetected }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [detectedItems, setDetectedItems] = useState([]);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMessage('');
      setDetectedItems([]);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setIsLoading(false);
    setErrorMessage('');
    setDetectedItems([]);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleAnalyzePhoto = async () => {
    if (!selectedImage) return;

    setIsLoading(true);
    setErrorMessage('');
    const sessionId = getSessionId();

    try {
      const result = await getIngredientsFromPhoto(selectedImage, sessionId);
      const items = result.ingredients || result.detected || [];

      if (items.length > 0) {
        setDetectedItems(items);
      } else {
        setErrorMessage("Couldn't read that photo — try a brighter shot with your fridge shelves in view.");
      }
    } catch (err) {
      console.error('Fridge photo scan failed:', err);
      setErrorMessage("Couldn't read that photo — try a brighter shot");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmIngredients = () => {
    if (detectedItems.length > 0) {
      onIngredientsDetected(detectedItems);
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm animate-fadeIn">
      {/* Hidden inputs: one with capture for camera, one standard for gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
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
            <span className="text-2xl">📸</span>
            <div>
              <h2 className="text-xl font-bold text-charcoal">Snap Your Fridge</h2>
              <p className="text-xs text-charcoal-muted">Show us what you're working with</p>
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

        {/* Content Body */}
        <div className="my-4 flex-1">
          {!previewUrl ? (
            <div className="py-8 px-4 flex flex-col items-center text-center">
              <div className="w-24 h-24 mb-4 rounded-3xl bg-tomato-soft flex items-center justify-center text-tomato text-4xl shadow-inner">
                🥫
              </div>
              <h3 className="font-bold text-lg text-charcoal mb-1">Got a fridge full of stuff?</h3>
              <p className="text-sm text-charcoal-muted max-w-xs mb-6">
                Take a quick photo of your fridge, freezer, or pantry shelf. We'll pull out the ingredients for you.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="touch-target w-full py-3.5 px-4 bg-tomato text-white font-bold rounded-xl shadow-md hover:bg-tomato-dark active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Take photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="touch-target w-full py-3.5 px-4 bg-white text-charcoal border border-charcoal-border font-bold rounded-xl shadow-sm hover:border-tomato hover:text-tomato active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Choose from library</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* Image Preview */}
              <div className="relative w-full max-h-72 rounded-xl overflow-hidden bg-black/5 border border-charcoal-border mb-4 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Fridge preview"
                  className="w-full h-full object-contain max-h-72"
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

              {/* Status & Messages */}
              {isLoading && (
                <div className="w-full py-4 px-3 bg-white rounded-xl border border-charcoal-border text-center shadow-sm">
                  <div className="inline-block animate-spin text-3xl mb-2">🍳</div>
                  <p className="font-bold text-charcoal">Scanning your shelves...</p>
                  <p className="text-xs text-charcoal-muted mt-1">Peeking for veggies, eggs, cheese, and pantry gems</p>
                </div>
              )}

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
                      Try another photo
                    </button>
                  </div>
                </div>
              )}

              {detectedItems.length > 0 && (
                <div className="w-full bg-basil-soft border border-basil/30 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-basil-dark">
                      Spotted {detectedItems.length} ingredients:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detectedItems.map((item, idx) => (
                      <span
                        key={idx}
                        className="bg-basil text-white px-2.5 py-1 rounded-full text-xs font-semibold"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="w-full flex gap-2">
                {!detectedItems.length && !isLoading && (
                  <button
                    type="button"
                    onClick={handleAnalyzePhoto}
                    className="touch-target flex-1 py-3 px-4 bg-tomato text-white font-bold rounded-xl shadow-md hover:bg-tomato-dark active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Read ingredients ✨</span>
                  </button>
                )}

                {detectedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleConfirmIngredients}
                    className="touch-target flex-1 py-3 px-4 bg-basil text-white font-bold rounded-xl shadow-md hover:bg-basil-dark active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Add to my kitchen 🍳</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="touch-target py-3 px-4 bg-white border border-charcoal-border text-charcoal font-semibold rounded-xl hover:bg-cream-50 active:scale-95 transition-all"
                >
                  Retake
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
