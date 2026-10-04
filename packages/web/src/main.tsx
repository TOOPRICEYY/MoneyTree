import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { EmbedApp } from './EmbedApp.tsx';
import { EMBED_PREFIX } from './embedRoute.ts';
import './embed.css';
import './shell.css';

// One bundle, two shells: /embed/* is the frame Actual hosts; everything
// else is the standalone app.
const isEmbed = window.location.pathname.startsWith(EMBED_PREFIX);
document.documentElement.classList.add(isEmbed ? 'mt-embed' : 'mt-standalone');

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

createRoot(root).render(
  <StrictMode>{isEmbed ? <EmbedApp /> : <App />}</StrictMode>,
);
