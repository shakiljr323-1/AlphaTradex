import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ignore third-party browser extension injection/messaging errors (e.g. content.js)
// so extension noise never interferes with the application error boundary or preview.
const isExtensionError = (source?: string, message?: string): boolean => {
  const src = String(source || '');
  const msg = String(message || '');
  return (
    src.startsWith('chrome-extension://') ||
    src.startsWith('moz-extension://') ||
    src.startsWith('safari-web-extension://') ||
    msg.includes('Could not establish connection. Receiving end does not exist')
  );
};

window.addEventListener(
  'error',
  (event) => {
    const errMsg = event.error instanceof Error ? event.error.message : event.message;
    const stack = event.error instanceof Error ? event.error.stack : '';
    if (isExtensionError(event.filename, errMsg) || isExtensionError(stack, errMsg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);

window.addEventListener(
  'unhandledrejection',
  (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason || '');
    const stack = reason instanceof Error ? reason.stack : '';
    if (isExtensionError(stack, msg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);

createRoot(document.getElementById('root')!).render(<App />);
