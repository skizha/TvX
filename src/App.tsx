import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAppStore } from './store';
import {
  LoginPage,
  LivePage,
  MoviesPage,
  SeriesPage,
  DetailPage,
  PlayerPage,
  VideoWindowPage,
  SearchPage,
  FavoritesPage,
  SettingsPage,
} from './pages';
import './App.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isConnected = useAppStore((state) => state.isConnected);

  if (!isConnected) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
