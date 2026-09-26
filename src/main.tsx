import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App.tsx';
import './index.css';

// Service Worker registrieren. Updates werden nicht automatisch aktiviert;
// der Hinweis „Update verfügbar – neu laden“ folgt in E6.
registerSW({ immediate: true });

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
