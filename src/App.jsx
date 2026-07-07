import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import OverviewDashboard from './pages/dashboard/OverviewDashboard';
import RegionalDetails from './pages/dashboard/Regional_Detail';
import ESGIndicator from './pages/ESG/esg_indicator';
import SDGProgress from './pages/SDG/sdg_progress';
import MyProfile from './pages/profile/MyProfile';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ResetPassword from './pages/auth/ResetPassword';
import DataSources from './pages/info/DataSources';
import About from './pages/info/About';
import SubmitReport from './pages/reports/SubmitReport';
import ReportTracking from './pages/reports/ReportTracking';
import CommunityReport from './pages/reports/CommunityReport';
import UserManagement from './pages/admin/UserManagement';
import ReportVerification from './pages/admin/ReportVerification';

// Registered users only (public visitors are sent to login)
function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return isAdmin ? children : <Navigate to="/" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<OverviewDashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/community-report" element={<CommunityReport />} />
          <Route path="/data-sources" element={<DataSources />} />
          <Route path="/about" element={<About />} />

          {/* Registered users */}
          <Route path="/regions" element={<RequireAuth><RegionalDetails /></RequireAuth>} />
          <Route path="/esg" element={<RequireAuth><ESGIndicator /></RequireAuth>} />
          <Route path="/sdg" element={<RequireAuth><SDGProgress /></RequireAuth>} />
          <Route path="/submit-report" element={<RequireAuth><SubmitReport /></RequireAuth>} />
          <Route path="/report-tracking" element={<RequireAuth><ReportTracking /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><MyProfile /></RequireAuth>} />

          {/* Admin */}
          <Route path="/admin/users" element={<RequireAdmin><UserManagement /></RequireAdmin>} />
          <Route path="/admin/reports" element={<RequireAdmin><ReportVerification /></RequireAdmin>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
