import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from './components/layout/AppShell';
import { NexusProvider, useNexus } from './store/NexusContext';
import { useScreenInit } from './useScreenInit.js';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { DevicesPage } from './pages/Devices';
import { DeviceDetailPage } from './pages/DeviceDetail';
import { ConfigurationsPage } from './pages/Configurations';
import { ConfigurationDetailPage } from './pages/ConfigurationDetail';
import { CompliancePage } from './pages/Compliance';
import { ComplianceRuleDetailPage } from './pages/ComplianceRuleDetail';
import { NetworkIntentPage } from './pages/NetworkIntent';
import { ReachabilityPage } from './pages/Reachability';
import { TopologyPage } from './pages/Topology';
import { VendorsPage } from './pages/Vendors';
import { DependenciesPage } from './pages/Dependencies';
import { DriftPage } from './pages/Drift';
import { FindingsPage } from './pages/Findings';
import { FindingDetailPage } from './pages/FindingDetail';
import { AIAssistantPage } from './pages/AIAssistant';
import { ReportsPage } from './pages/Reports';
import { RiskAnalysisPage } from './pages/RiskAnalysis';
import { SettingsPage } from './pages/Settings';

function RequireAuth({ children }: {children: React.ReactNode;}) {
  const { user } = useNexus();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppShell>{children}</AppShell>;
}

/** Optional launch shortcut: sign in as the demo analyst with the demo fleet loaded. */
function DemoBootstrap({ enabled }: {enabled: boolean;}) {
  const { user, demoLogin, loadDemoEnvironment, hasData } = useNexus();
  const done = useRef(false);
  useEffect(() => {
    if (!enabled || done.current) return;
    if (!user) {
      demoLogin();
      return;
    }
    if (!hasData) loadDemoEnvironment();
    done.current = true;
  }, [enabled, user, hasData, demoLogin, loadDemoEnvironment]);
  return null;
}

export function App({ demoMode = false }: {demoMode?: boolean;}) {
  const screenInit = useScreenInit();
  const [bootstrapDemo] = useState<boolean>(
    typeof screenInit.demo === 'boolean' ? screenInit.demo : demoMode
  );

  return (
    <NexusProvider>
      <BrowserRouter>
        <DemoBootstrap enabled={bootstrapDemo} />
        <Toaster theme="dark" position="top-right" richColors closeButton />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
            <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            } />
          
          <Route
            path="/devices"
            element={
            <RequireAuth>
                <DevicesPage />
              </RequireAuth>
            } />
          
          <Route
            path="/devices/:id"
            element={
            <RequireAuth>
                <DeviceDetailPage />
              </RequireAuth>
            } />
          
          <Route
            path="/configurations"
            element={
            <RequireAuth>
                <ConfigurationsPage />
              </RequireAuth>
            } />
          
          <Route
            path="/configurations/:id"
            element={
            <RequireAuth>
                <ConfigurationDetailPage />
              </RequireAuth>
            } />
          
          <Route
            path="/compliance"
            element={
            <RequireAuth>
                <CompliancePage />
              </RequireAuth>
            } />
          
          <Route
            path="/compliance/:ruleId"
            element={
            <RequireAuth>
                <ComplianceRuleDetailPage />
              </RequireAuth>
            } />
          
          <Route
            path="/network-intent"
            element={
            <RequireAuth>
                <NetworkIntentPage />
              </RequireAuth>
            } />
          
          <Route
            path="/reachability"
            element={
            <RequireAuth>
                <ReachabilityPage />
              </RequireAuth>
            } />
          
          <Route
            path="/topology"
            element={
            <RequireAuth>
                <TopologyPage />
              </RequireAuth>
            } />
          
          <Route
            path="/vendors"
            element={
            <RequireAuth>
                <VendorsPage />
              </RequireAuth>
            } />
          
          <Route
            path="/dependencies"
            element={
            <RequireAuth>
                <DependenciesPage />
              </RequireAuth>
            } />
          
          <Route
            path="/drift"
            element={
            <RequireAuth>
                <DriftPage />
              </RequireAuth>
            } />
          
          <Route
            path="/findings"
            element={
            <RequireAuth>
                <FindingsPage />
              </RequireAuth>
            } />
          
          <Route
            path="/findings/:id"
            element={
            <RequireAuth>
                <FindingDetailPage />
              </RequireAuth>
            } />
          
          <Route
            path="/ai-assistant"
            element={
            <RequireAuth>
                <AIAssistantPage />
              </RequireAuth>
            } />
          
          <Route
            path="/reports"
            element={
            <RequireAuth>
                <ReportsPage />
              </RequireAuth>
            } />
          
          <Route
            path="/risk-analysis"
            element={
            <RequireAuth>
                <RiskAnalysisPage />
              </RequireAuth>
            } />
          
          <Route
            path="/settings"
            element={
            <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            } />
          
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </NexusProvider>);

}