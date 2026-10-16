import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Admin from './components/Admin.jsx';
import './index.css';

// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
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
}

const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </React.StrictMode>
);
