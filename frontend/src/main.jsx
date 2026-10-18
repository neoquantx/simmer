import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Admin from './components/Admin.jsx';
import './index.css';

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Simmer service worker registered: ', registration.scope);
        })
        .catch((error) => {
          console.warn('Simmer service worker registration failed: ', error);
        });
    });
  } else {
    // A worker left over from a production build would serve stale dev modules.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  }
}

const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </React.StrictMode>
);
