import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { Layout } from './components/Layout';
import { useAppStore, useSettingsStore } from './store';
import type { ContentType } from './types';
import './App.css';

const LoginPage = lazy(() => import('./pages/Login').then((m) => ({ default: m.LoginPage })));
const LivePage = lazy(() => import('./pages/Live').then((m) => ({ default: m.LivePage })));
const MoviesPage = lazy(() => import('./pages/Movies').then((m) => ({ default: m.MoviesPage })));
const SeriesPage = lazy(() => import('./pages/Series').then((m) => ({ default: m.SeriesPage })));
const DetailPage = lazy(() => import('./pages/Detail').then((m) => ({ default: m.DetailPage })));
const PlayerPage = lazy(() => import('./pages/Player').then((m) => ({ default: m.PlayerPage })));
const VideoWindowPage = lazy(() => import('./pages/VideoWindow').then((m) => ({ default: m.VideoWindowPage })));
const SearchPage = lazy(() => import('./pages/Search').then((m) => ({ default: m.SearchPage })));
const FavoritesPage = lazy(() => import('./pages/Favorites').then((m) => ({ default: m.FavoritesPage })));
const WatchHistoryPage = lazy(() => import('./pages/WatchHistory').then((m) => ({ default: m.WatchHistoryPage })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isConnected = useAppStore((state) => state.isConnected);

  if (!isConnected) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

function App() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ server_id: string; content_type: string; content_id: number; progress_secs: number }>(
      'playback-progress',
      (e) => {
        useSettingsStore.getState().updateWatchHistoryProgress(
          e.payload.server_id,
          e.payload.content_type as ContentType,
          e.payload.content_id,
          e.payload.progress_secs
        );
      }
    ).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes with layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/live" replace />} />
            <Route path="/live" element={<LivePage />} />
            <Route path="/movie" element={<MoviesPage />} />
            <Route path="/series" element={<SeriesPage />} />
            <Route path="/detail/:type/:id" element={<DetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/watch-history" element={<WatchHistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Player route (fullscreen, no layout) */}
          <Route
            path="/player/:type/:id"
            element={
              <ProtectedRoute>
                <PlayerPage />
              </ProtectedRoute>
            }
          />

          {/* Video window (no layout, no auth – opened as second Tauri window) */}
          <Route path="/video-window" element={<VideoWindowPage />} />

          {/* Catch all - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
