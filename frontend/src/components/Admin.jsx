import React, { useCallback, useEffect, useState } from 'react';
import {
  adminLogin,
  adminLogout,
  listPaymentClaims,
  togglePaymentClaim,
} from '../utils/api.js';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [claims, setClaims] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  const loadClaims = useCallback(async () => {
    const data = await listPaymentClaims();
    setClaims(data.claims || []);
    setAuthed(true);
    setError('');
  }, []);

  useEffect(() => {
    loadClaims().catch(() => {
      setAuthed(false);
    });
  }, [loadClaims]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await adminLogin(password);
      setPassword('');
      await loadClaims();
    } catch (err) {
      setError(err.message || 'Login failed.');
    }
  };

  const handleToggle = async (claim, paid) => {
    setBusyId(claim.id);
    setMessage('');
    setError('');
    try {
      const data = await togglePaymentClaim(claim.id, paid);
      let next = data.message || (paid ? 'Marked paid.' : 'Paid access removed.');
      if (paid && data.email?.sent) {
        next += ` PDF receipt sent to ${data.email.to}.`;
      } else if (paid && data.email && !data.email.sent && data.email.error) {
        next += ` Email not sent: ${data.email.error}`;
      }
      setMessage(next);
      await loadClaims();
    } catch (err) {
      setError(err.message || 'Could not update claim.');
    } finally {
      setBusyId('');
    }
  };

  const handleLogout = async () => {
    await adminLogout().catch(() => {});
    setAuthed(false);
    setClaims([]);
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4 font-sans">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-3xl border border-charcoal-border bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-black uppercase tracking-[0.16em] text-tomato">Simmer admin</p>
          <h1 className="mt-2 text-2xl font-black">Check UPI payments</h1>
          <p className="mt-2 text-sm text-charcoal-muted">
            Confirm the UTR in your UPI app, then toggle Paid for that kitchen.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-5 w-full rounded-xl border border-charcoal-border px-3 py-3 text-sm font-semibold"
            placeholder="Admin password"
            required
          />
          {error && <p className="mt-2 text-sm font-semibold text-tomato">{error}</p>}
          <button
            type="submit"
            className="mt-4 w-full rounded-2xl bg-tomato py-3 text-white font-black"
          >
            Open claims
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream px-4 py-8 font-sans">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-tomato">Simmer admin</p>
            <h1 className="mt-1 text-3xl font-black">Payment claims</h1>
            <p className="mt-2 text-sm text-charcoal-muted">
              Toggle Paid only after you see the ₹99 credit for that UTR.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-charcoal-border bg-white px-3 py-2 text-sm font-bold"
          >
            Log out
          </button>
        </div>

        {message && (
          <p className="mt-4 rounded-xl border border-basil/30 bg-basil-soft px-3 py-2 text-sm font-semibold text-basil-dark">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-tomato/30 bg-tomato-soft px-3 py-2 text-sm font-semibold text-tomato-dark">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-3">
          {claims.length === 0 && (
            <p className="rounded-2xl border border-dashed border-charcoal-border bg-white p-6 text-sm text-charcoal-muted">
              No claims yet. When someone pays and pastes a UTR, it shows up here.
            </p>
          )}

          {claims.map((claim) => {
            const isPaid = claim.status === 'paid';
            return (
              <article
                key={claim.id}
                className="rounded-2xl border border-charcoal-border bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-lg">{claim.email}</p>
                    <p className="mt-1 font-mono text-sm tracking-wide">{claim.utr}</p>
                    {claim.note ? (
                      <p className="mt-2 text-sm text-charcoal-muted">Note: {claim.note}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-charcoal-muted">
                      Session {claim.session_id?.slice(0, 8)}… · {claim.created_at}
                      {isPaid && claim.paid_until ? ` · until ${claim.paid_until}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                        isPaid ? 'bg-basil text-white' : 'bg-cream-200 text-charcoal-muted'
                      }`}
                    >
                      {isPaid ? 'Paid' : 'Pending'}
                    </span>
                    <button
                      type="button"
                      disabled={busyId === claim.id}
                      onClick={() => handleToggle(claim, !isPaid)}
                      className={`relative h-8 w-14 rounded-full transition-colors ${
                        isPaid ? 'bg-basil' : 'bg-charcoal-border'
                      }`}
                      aria-pressed={isPaid}
                      aria-label={isPaid ? 'Mark as not paid' : 'Mark as paid'}
                    >
                      <span
                        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                          isPaid ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
