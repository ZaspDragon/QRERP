import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ERPProvider } from './context/ERPContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <ERPProvider>
        <App />
      </ERPProvider>
    </HashRouter>
  </React.StrictMode>,
);
