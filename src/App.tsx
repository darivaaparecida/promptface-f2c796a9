import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { ScenariosPage } from './pages/ScenariosPage';
import { CreatePage } from './pages/CreatePage';
import { StudioPage } from './pages/StudioPage';
import { VisualProfilePage } from './pages/VisualProfilePage';
import { MySpacePage } from './pages/MySpacePage';
import { PlansPage } from './pages/PlansPage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { LgpdPage, PrivacyPage, TermsPage } from './pages/LegalPages';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="relative min-h-screen flex flex-col bg-[#08080C] text-white overflow-x-hidden">
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 pf-ambient-bg" />
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 pf-ambient-grid" />
          <div className="relative z-10 flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/cenarios" element={<ScenariosPage />} />
              <Route path="/planos" element={<PlansPage />} />
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
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
