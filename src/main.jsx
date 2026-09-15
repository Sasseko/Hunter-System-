import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const root = document.getElementById('root');

function showError(err) {
  const message = (err && (err.stack || err.message)) || String(err);
  root.innerHTML =
    '<pre style="color:#fff;background:#000;padding:16px;white-space:pre-wrap;font-size:12px;">' +
    message +
    '</pre>';
}

window.addEventListener('error', (e) => showError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showError(e.reason));

try {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err) {
  showError(err);
}
