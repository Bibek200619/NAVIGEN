import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/Dashboard/Dashboard';
import { RobotPage } from './pages/Robot/Robot';
import { MissionPage } from './pages/Mission/Mission';
import { SensorsPage } from './pages/Sensors/Sensors';
import { CameraPage } from './pages/Camera/Camera';
import { LogsPage } from './pages/Logs/Logs';
import { SettingsPage } from './pages/Settings/Settings';
import { ROUTES } from './constants/routes';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
          <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
          <Route path={ROUTES.ROBOT} element={<RobotPage />} />
          <Route path={ROUTES.MISSION} element={<MissionPage />} />
          <Route path={ROUTES.SENSORS} element={<SensorsPage />} />
          <Route path={ROUTES.CAMERA} element={<CameraPage />} />
          <Route path={ROUTES.LOGS} element={<LogsPage />} />
          <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
          <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
