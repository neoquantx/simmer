import React, { useEffect, useState } from 'react';
import { YEARLY_PRICE } from '../utils/usage.js';
import { getPaymentInfo, submitPaymentClaim } from '../utils/api.js';
import { getSessionId } from '../utils/session.js';

export default function YearlyOffer({ onClose, onViewSaved, onClaimed }) {
  const [info, setInfo] = useState(null);
  const [email, setEmail] = useState('');
  const [utr, setUtr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    getPaymentInfo()
      .then((data) => {
        if (alive) setInfo(data);
      })
      .catch(() => {
        if (alive) setInfo({ configured: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await submitPaymentClaim({
        email,
        utr,
        note,
        sessionId: getSessionId(),
      });
      setDone(true);
      onClaimed?.();
    } catch (err) {
      setError(err.message || 'Could not save your claim.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-charcoal/50 px-4 pb-4 sm:pb-0">
      <div
        role="dialog"
        aria-labelledby="yearly-offer-title"
        className="w-full max-w-md bg-cream rounded-3xl p-6 shadow-hover border border-charcoal-border max-h-[92vh] overflow-y-auto"
      >
        <p className="text-xs font-black uppercase tracking-[0.16em] text-tomato">Simmer for a year</p>
        <h2 id="yearly-offer-title" className="mt-2 text-2xl font-black tracking-tight">
          Your 3 free meals are used
        </h2>
        <p className="mt-3 text-sm font-semibold text-charcoal-muted leading-relaxed">
          Pay {YEARLY_PRICE} on UPI, paste the UTR, and your email. After the payment is checked, this kitchen unlocks for a year.
        </p>
        <p className="mt-4 text-4xl font-black">
          {YEARLY_PRICE}
          <span className="text-base font-bold text-charcoal-muted"> / year</span>
        </p>

        {done ? (
          <div className="mt-5 rounded-2xl border border-basil/30 bg-basil-soft p-4">
            <p className="font-bold text-basil-dark">Claim received</p>
            <p className="mt-1 text-sm text-charcoal-muted">
              Access opens once the UTR is confirmed on the admin page. You can keep using saved meals in the meantime.
            </p>
          </div>
        ) : (
          <>
            {info?.configured && info.qr_data_url ? (
              <div className="mt-5 flex flex-col items-center rounded-2xl border border-charcoal-border bg-white p-4">
                <img src={info.qr_data_url} alt="UPI QR for Simmer year" className="h-44 w-44" />
                <p className="mt-2 text-sm font-bold">{info.upi_id}</p>
                <p className="text-xs text-charcoal-muted">Scan with PhonePe, GPay, or Paytm · ₹{info.amount_inr}</p>
                {info.upi_uri && (
                  <a
                    href={info.upi_uri}
                    className="mt-3 text-sm font-bold text-tomato underline"
                  >
                    Open UPI app
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-5 rounded-2xl border border-tomato/30 bg-tomato-soft p-3 text-sm font-semibold text-tomato-dark">
                UPI is not configured yet. Add SIMMER_UPI_ID in backend/.env and restart the API.
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-charcoal-muted">Email for receipt</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-charcoal-border bg-white px-3 py-3 text-sm font-semibold"
                  placeholder="you@email.com"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-charcoal-muted">UPI UTR / reference</span>
                <input
                  type="text"
                  required
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-charcoal-border bg-white px-3 py-3 text-sm font-semibold tracking-wide"
                  placeholder="12-digit UTR from your app"
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-charcoal-muted">Note (optional)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-charcoal-border bg-white px-3 py-3 text-sm font-semibold"
                  placeholder="Anything for the receipt note"
                />
              </label>
              {error && <p className="text-sm font-semibold text-tomato">{error}</p>}
              <button
                type="submit"
                disabled={busy || !info?.configured}
                className="w-full py-4 rounded-2xl bg-tomato text-white font-black text-lg shadow-lift disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? 'Sending…' : `I paid ${YEARLY_PRICE}`}
              </button>
            </form>
          </>
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
