import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { requestPersistentStorage } from './app/platform.ts';
import { initServiceWorker } from './app/update.ts';
import './index.css';

initServiceWorker();
// Dauerhaften Speicher anfordern (iOS löscht sonst unter Umständen Website-Daten).
void requestPersistentStorage();

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
