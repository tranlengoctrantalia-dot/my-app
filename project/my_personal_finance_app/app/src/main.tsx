import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { LockGate } from './lock';
import { CrashGuard } from './components/Crash';
import { StoreProvider } from './store';
import { DriveSyncProvider } from './sync/DriveSync';
import { applyStoredTheme } from './theme';
import { trackVisualViewport } from './viewport';
import '@fontsource/montserrat/300.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import './styles.css';

registerSW({ immediate: true });

// Vừa có bản mới mà máy còn chạy bản cũ → file của bản cũ đã bị xoá trên máy chủ. Tải lại một lần để lấy bản mới.
window.addEventListener('vite:preloadError', (e) => {
  try {
    if (sessionStorage.getItem('vg-reloaded')) return;
    sessionStorage.setItem('vg-reloaded', '1');
  } catch {
    /* bỏ qua */
  }
  e.preventDefault();
  location.reload();
});
(window as { __vgBooted?: boolean }).__vgBooted = true;

applyStoredTheme();
trackVisualViewport();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CrashGuard>
      <LockGate>
        <StoreProvider>
          <DriveSyncProvider>
            <App />
          </DriveSyncProvider>
        </StoreProvider>
      </LockGate>
    </CrashGuard>
  </StrictMode>,
);
