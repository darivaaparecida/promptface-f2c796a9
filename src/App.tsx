import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Toaster } from './components/Toaster';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminMaintenanceBanner, MaintenanceView } from './components/MaintenanceView';
import { HomePage } from './pages/HomePage';
import { ScenariosPage } from './pages/ScenariosPage';
import { CreatePage } from './pages/CreatePage';
import { StudioPage } from './pages/StudioPage';
import { VisualProfilePage } from './pages/VisualProfilePage';
import { MySpacePage } from './pages/MySpacePage';
import { PlansPage } from './pages/PlansPage';
import { LoginPage } from './pages/LoginPage';
import { InvitePage } from './pages/InvitePage';
import { GalleryPage } from './pages/GalleryPage';
import { AdminPage } from './pages/AdminPage';
import { LgpdPage, PrivacyPage, TermsPage } from './pages/LegalPages';
import { normalizeInviteCode } from './shared/invites';

/** /convite/CODIGO → /login?convite=CODIGO (abre o cadastro com o convite). */
function InviteRedirect() {
  const { code } = useParams();
  const inviteCode = normalizeInviteCode(code ?? null);
  return (
    <Navigate to={inviteCode ? `/login?convite=${inviteCode}` : '/login'} replace />
  );
}

function AppShell() {
  const { user, loading, config, refreshConfig } = useAuth();
  const location = useLocation();

  const maintenanceActive = Boolean(config.maintenance?.enabled);
  const isAdmin = user?.role === 'admin';
  const showMaintenancePage =
    !loading && maintenanceActive && !isAdmin && location.pathname !== '/login';

  return (
    <div className="relative min-h-screen flex flex-col bg-slate-50 text-slate-950 dark:bg-[#08080C] dark:text-white overflow-x-hidden transition-colors duration-200">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 pf-ambient-bg" />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 pf-ambient-grid" />
      <div className="relative z-10 flex flex-col min-h-screen">
        {showMaintenancePage ? (
          <>
            <Toaster />
            <main className="flex-1">
              <MaintenanceView
                maintenance={config.maintenance}
                onRefreshStatus={refreshConfig}
              />
            </main>
          </>
        ) : (
          <>
            {maintenanceActive && isAdmin && <AdminMaintenanceBanner />}
            <Navbar />
            <Toaster />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/cenarios" element={<ScenariosPage />} />
                <Route path="/planos" element={<PlansPage />} />
                <Route path="/convites" element={<InvitePage />} />
                <Route path="/galeria" element={<GalleryPage />} />
                <Route path="/convite/:code" element={<InviteRedirect />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/termos" element={<TermsPage />} />
                <Route path="/privacidade" element={<PrivacyPage />} />
                <Route path="/lgpd" element={<LgpdPage />} />

                <Route
                  path="/criar"
                  element={
                    <ProtectedRoute>
                      <CreatePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/studio"
                  element={
                    <ProtectedRoute>
                      <StudioPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/perfil-visual"
                  element={
                    <ProtectedRoute>
                      <VisualProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/meu-espaco"
                  element={
                    <ProtectedRoute>
                      <MySpacePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
