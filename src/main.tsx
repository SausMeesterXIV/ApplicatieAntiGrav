import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// === iOS Viewport Height Fix ===
// CSS units (vh, dvh, -webkit-fill-available) are unreliable on many iPhone models.
// This sets --app-height to the EXACT visible viewport height via JS.
function setAppHeight() {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', () => {
    // Small delay needed after orientation change for innerHeight to update
    setTimeout(setAppHeight, 100);
});
setAppHeight();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
