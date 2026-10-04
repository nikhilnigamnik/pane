import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';
import { setupMonaco } from './lib/monaco-setup';
import './styles/index.css';

setupMonaco();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
