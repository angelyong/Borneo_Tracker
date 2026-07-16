import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OverviewDashboard from './pages/dashboard/OverviewDashboard';
import RegionalDetails from './pages/dashboard/Regional_Detail';
import ESGIndicator from './pages/ESG/esg_indicator';
import SDGProgress from './pages/SDG/sdg_progress';
import MyProfile from './pages/profile/MyProfile';
import NewsPage from './pages/news/NewsPage';
import NewsDetailPage from './pages/news/NewsDetailPage';
import NewsReview from './pages/admin/news/NewsReview';
import UserManagement from './pages/admin/UserManagement';
import AboutPage from './pages/about/AboutPage';
import CommunityPage from './pages/community/CommunityPage';
import GenerateReportPage from './pages/reports/GenerateReportPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import CheckEmailPage from './pages/auth/CheckEmailPage';
import Layout from './components/layout_new';
import { ProtectedRoute, RequireAdmin } from './auth/ProtectedRoute';

const Placeholder = ({ title }) => (
  <div style={{ padding: '40px', fontSize: '24px', textAlign: 'center' }}>
    {title} Page (Coming Soon)
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/check-email" element={<CheckEmailPage />} />

        <Route element={<Layout />}>
          <Route path="/" element={<OverviewDashboard />} />
          <Route path="/regions" element={<RegionalDetails />} />
          <Route path="/esg" element={<ESGIndicator />} />
          <Route path="/sdg" element={<SDGProgress />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/:articleId" element={<NewsDetailPage />} />
          <Route
            path="/admin/news"
            element={
              <RequireAdmin>
                <NewsReview />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAdmin>
                <UserManagement />
              </RequireAdmin>
            }
          />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/reports" element={<GenerateReportPage />} />
          <Route path="/submission" element={<Placeholder title="Submit Report" />} />

          <Route path="/data-sources" element={<Placeholder title="Data Sources" />} />
          <Route path="/about" element={<AboutPage />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <MyProfile />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
