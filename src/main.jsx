import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initTheme } from './ui/theme.js';
import './styles.css';
import './ds.css';

initTheme();
createRoot(document.getElementById('root')).render(<App />);
