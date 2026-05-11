/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppStore } from './store/AppContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Contributors } from './pages/Contributors';
import { Communications } from './pages/Communications';
import { Technologies } from './pages/Technologies';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authConfig } = useAppStore();
  const location = useLocation();

  if (!authConfig.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="contributors" element={<Contributors />} />
            <Route path="tech" element={<Technologies />} />
            <Route path="comms" element={<ProtectedRoute><Communications /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
