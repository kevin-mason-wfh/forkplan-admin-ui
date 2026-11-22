import { createRoot } from 'react-dom/client';
import './styles.css';
import { loadConfig } from './auth.js';
import App from './App.jsx';

loadConfig().then(
  () => createRoot(document.getElementById('root')).render(<App />),
  (e) => { document.getElementById('root').textContent = 'Could not load /config.json: ' + e.message; },
);
