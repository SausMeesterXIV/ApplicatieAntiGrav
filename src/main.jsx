import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { herlaadNaUpdate } from './lib/herladen';

// Vite meldt hier bestanden die niet meer bestaan na een nieuwe versie
window.addEventListener('vite:preloadError', event => {
  if (herlaadNaUpdate()) event.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
