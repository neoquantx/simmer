import React from 'react';
import { YEARLY_PRICE } from '../utils/usage.js';

const STEPS = [
  { icon: '📷', title: 'Snap the fridge', text: 'Or type what you already have.' },
  { icon: '🍽️', title: 'Get 3 ideas', text: 'Breakfast, lunch, snacks, or dinner.' },
  { icon: '🛒', title: 'Copy what to buy', text: 'A short list, ranked by the least extra shopping.' },
];

export default function Landing({ onEnter }) {
  return (
    <div className="min-h-screen bg-cream text-charcoal">
      <main className="max-w-xl mx-auto px-5 pt-12 pb-16">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-tomato">Simmer</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight leading-tight">
          What’s the next meal?
        </h1>
        <p className="mt-4 text-lg font-semibold text-charcoal-muted leading-relaxed">
          For the person cooking after work, before office, or between the two. Three doable ideas from what is already in the kitchen.
        </p>

        <ol className="mt-8 space-y-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 bg-white rounded-3xl p-4 border border-charcoal-border shadow-soft"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cream-200 text-xl">
                {step.icon}
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-charcoal-light">
                  {index + 1}
                </p>
                <p className="font-black text-lg leading-tight">{step.title}</p>
                <p className="text-sm font-semibold text-charcoal-muted mt-0.5">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-8 rounded-3xl bg-charcoal text-cream p-6">
          <p className="text-sm font-bold text-cream/80">Try 3 meals free.</p>
          <p className="mt-1 text-3xl font-black">Then {YEARLY_PRICE} for the year.</p>
          <p className="mt-3 text-sm font-semibold text-cream/75 leading-relaxed">
            Unlimited breakfast, lunch, snacks, and dinner. The model runs on your machine, so a fridge photo is not sent to a paid API.
          </p>
        </section>

        <button
          type="button"
          onClick={onEnter}
          className="mt-6 w-full py-4 rounded-2xl bg-tomato hover:bg-tomato-dark text-white font-black text-lg shadow-lift active:scale-[0.98] transition-all"
        >
          Open the kitchen
        </button>
        <p className="mt-4 text-center text-xs font-bold text-charcoal-muted">
          No account. Your pantry stays saved in your kitchen.
        </p>
      </main>
    </div>
  );
}
