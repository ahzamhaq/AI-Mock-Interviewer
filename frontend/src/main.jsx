import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// Non-blocking font stylesheet: index.html ships it as media="print" and we
// flip it here, because an inline onload handler would violate the CSP.
document.querySelectorAll('link[data-async-font]').forEach((link) => {
  link.media = 'all';
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
