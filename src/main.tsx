import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Helper: read a CSS env() variable by injecting a temporary element
function readSafeAreaInset(): number {
  const el = document.createElement('div');
  el.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
  el.style.position = 'fixed';
  el.style.visibility = 'hidden';
  document.body.appendChild(el);
  const value = parseFloat(getComputedStyle(el).paddingBottom) || 0;
  document.body.removeChild(el);
  return value;
}

function setAppDimensions() {
  // Set app height
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);

  // Force-read the safe area inset via JS so iOS WebView computes it correctly on load
  const safeAreaBottom = readSafeAreaInset();
  document.documentElement.style.setProperty('--safe-area-bottom', `${safeAreaBottom}px`);
}

// Run immediately and after a short delay for iOS WebView to finish its initial layout
setAppDimensions();
setTimeout(setAppDimensions, 100);
setTimeout(setAppDimensions, 300);

window.addEventListener('resize', setAppDimensions);
window.addEventListener('orientationchange', () => {
  // iOS fires orientationchange before the viewport is resized, so wait
  setTimeout(setAppDimensions, 150);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
