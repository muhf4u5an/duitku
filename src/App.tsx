import { useEffect, useRef, useState } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ensureSeed, getMeta, requestPersistence } from './db';
import { applyTheme, type ThemePref } from './lib/theme';
import { hasPin } from './lib/pin';
import { getGmailConfig, syncGmail } from './lib/importer';
import { TabBar } from './components/TabBar';
import { LockScreen } from './components/LockScreen';
import { ToastProvider } from './components/ui';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import AddTransaction from './pages/AddTransaction';
import Tidy from './pages/Tidy';
import History from './pages/History';
import Plans from './pages/Plans';
import PlanForm from './pages/PlanForm';
import PlanDetail from './pages/PlanDetail';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

const LOCK_AFTER_MS = 5 * 60 * 1000;
const TAB_ROUTES = ['/', '/inbox', '/plans', '/reports', '/history'];

function Shell() {
  const loc = useLocation();
  const showTabs = TAB_ROUTES.includes(loc.pathname);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/add" element={<AddTransaction />} />
        <Route path="/tx/:id" element={<Tidy />} />
        <Route path="/history" element={<History />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/plans/new" element={<PlanForm />} />
        <Route path="/plans/:id/edit" element={<PlanForm />} />
        <Route path="/plans/:id" element={<PlanDetail />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      {showTabs && <TabBar />}
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      await ensureSeed();
      applyTheme(await getMeta<ThemePref>('theme', 'system'));
      setLocked(await hasPin());
      setReady(true);
      requestPersistence();
      if (await getGmailConfig()) syncGmail().catch(() => {});
    })();
  }, []);

  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
      } else {
        if (hiddenAt.current && Date.now() - hiddenAt.current > LOCK_AFTER_MS && (await hasPin())) setLocked(true);
        hiddenAt.current = null;
        if (await getGmailConfig()) syncGmail().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (!ready) return null;
  return (
    <ToastProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
      {locked && <LockScreen onUnlock={() => setLocked(false)} />}
    </ToastProvider>
  );
}
