import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { AdminRoute, GuestOnlyRoute, ProtectedRoute } from './auth/ProtectedRoute';
import Layout from './components/layout_new';
import AboutPage from './pages/about/AboutPage';
import NewsReview from './pages/admin/news/NewsReview';
import CheckEmailPage from './pages/auth/CheckEmailPage';
import ConfirmEmailChangePage from './pages/auth/ConfirmEmailChangePage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import CommunityPage from './pages/community/CommunityPage';
import OverviewDashboard from './pages/dashboard/OverviewDashboard';
import RegionalDetails from './pages/dashboard/Regional_Detail';
import ESGIndicator from './pages/ESG/esg_indicator';
import NewsDetailPage from './pages/news/NewsDetailPage';
import NewsPage from './pages/news/NewsPage';
import MyProfile from './pages/profile/MyProfile';
import GenerateReportPage from './pages/reports/GenerateReportPage';
import SDGProgress from './pages/SDG/sdg_progress';

const Placeholder = ({ title }) => (
  <div style={{ padding: 40, fontSize: 24, textAlign: 'center' }}>{title} Page (Coming Soon)</div>
);

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
    <Route path="/register" element={<GuestOnlyRoute><RegisterPage /></GuestOnlyRoute>} />
    <Route path="/forgot-password" element={<GuestOnlyRoute><ForgotPasswordPage /></GuestOnlyRoute>} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route path="/check-email" element={<CheckEmailPage />} />
    <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />

    <Route element={<Layout />}>
      <Route path="/" element={<OverviewDashboard />} />
      <Route path="/regions" element={<RegionalDetails />} />
      <Route path="/esg" element={<ESGIndicator />} />
      <Route path="/sdg" element={<SDGProgress />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/news/:articleId" element={<NewsDetailPage />} />
      <Route path="/admin/news" element={<AdminRoute><NewsReview /></AdminRoute>} />
      <Route path="/community" element={<CommunityPage />} />
      <Route path="/reports" element={<GenerateReportPage />} />
      <Route path="/submission" element={<Navigate to="/incident_report" replace />} />
      <Route path="/incident_report" element={<ProtectedRoute><Placeholder title="Submit Report" /></ProtectedRoute>} />
      <Route path="/data-sources" element={<Placeholder title="Data Sources" />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
    </Route>

    <Route path="*" element={<div style={{ padding: 40, textAlign: 'center' }}><h1>Page not found</h1></div>} />
  </Routes>
);

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}
