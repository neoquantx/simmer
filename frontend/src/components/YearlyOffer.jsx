import React from 'react';
import { YEARLY_PRICE } from '../utils/usage.js';

const PAYMENT_URL = import.meta.env.VITE_PAYMENT_URL || '';

export default function YearlyOffer({ onClose, onViewSaved }) {
  const openPayment = () => {
    if (PAYMENT_URL) {
      window.open(PAYMENT_URL, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-charcoal/50 px-4 pb-4 sm:pb-0">
      <div
        role="dialog"
        aria-labelledby="yearly-offer-title"
        className="w-full max-w-md bg-cream rounded-3xl p-6 shadow-hover border border-charcoal-border"
      >
        <p className="text-xs font-black uppercase tracking-[0.16em] text-tomato">Simmer for a year</p>
        <h2 id="yearly-offer-title" className="mt-2 text-2xl font-black tracking-tight">
          Your 3 free meals are used
        </h2>
        <p className="mt-3 text-sm font-semibold text-charcoal-muted leading-relaxed">
          {YEARLY_PRICE} keeps breakfast, lunch, snacks, and dinner open for a year. Saved recipes and your pantry stay in your kitchen either way.
        </p>
        <p className="mt-4 text-4xl font-black">{YEARLY_PRICE}<span className="text-base font-bold text-charcoal-muted"> / year</span></p>

        <button
          type="button"
          onClick={openPayment}
          disabled={!PAYMENT_URL}
          className="mt-5 w-full py-4 rounded-2xl bg-tomato text-white font-black text-lg shadow-lift disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Get the year · {YEARLY_PRICE}
        </button>
        {!PAYMENT_URL && (
          <p className="mt-2 text-xs font-semibold text-charcoal-muted text-center">
            Checkout opens once a payment link is connected. Nothing is charged from this screen.
          </p>
        )}

        <button
          type="button"
          onClick={onViewSaved}
          className="mt-3 w-full py-3 rounded-2xl bg-white border border-charcoal-border font-bold"
        >
          Keep my saved meals
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full py-2 text-sm font-bold text-charcoal-muted"
        >
          Close
        </button>
      </div>
    </div>
  );
}
