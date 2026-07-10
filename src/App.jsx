import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OverviewDashboard from './pages/dashboard/OverviewDashboard';
import RegionalDetails from './pages/dashboard/Regional_Detail';
import ESGIndicator from './pages/ESG/esg_indicator';
import SDGProgress from './pages/SDG/sdg_progress';
import MyProfile from './pages/profile/MyProfile';
import NewsPage from './pages/news/NewsPage';
import NewsDetailPage from './pages/news/NewsDetailPage';
import Layout from './components/layout_new';

const Placeholder = ({ title }) => (
  <div style={{ padding: '40px', fontSize: '24px', textAlign: 'center' }}>
    {title} Page (Coming Soon)
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<OverviewDashboard />} />
          <Route path="/regions" element={<RegionalDetails />} />
          <Route path="/esg" element={<ESGIndicator />} />
          <Route path="/sdg" element={<SDGProgress />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/:articleId" element={<NewsDetailPage />} />
          <Route path="/submission" element={<Placeholder title="Submit Report" />} />
          <Route path="/incident_report" element={<Placeholder title="Incident Report" />} />
          <Route path="/data-sources" element={<Placeholder title="Data Sources" />} />
          <Route path="/about" element={<Placeholder title="About Borneo Tracker" />} />
          <Route path="/profile" element={<MyProfile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
