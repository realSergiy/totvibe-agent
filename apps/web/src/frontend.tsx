import { createRoot } from 'react-dom/client';

import { Root } from './Root';
import './index.css';

const container = document.querySelector('#root');
if (container) {
  createRoot(container).render(<Root />);
}
