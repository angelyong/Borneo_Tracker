import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OverviewDashboard from './pages/dashboard/OverviewDashboard';
import RegionalDetails from './pages/dashboard/Regional_Detail';
import ESGIndicator from './pages/ESG/esg_indicator';

 
// Placeholder components (create these later)
const Placeholder = ({ title }) => (
  <div style={{ padding: '40px', fontSize: '24px', textAlign: 'center' }}>
    {title} Page (Coming Soon)
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OverviewDashboard />} />
        <Route path="/regions" element={<RegionalDetails/>} />
        <Route path="/esg" element={<ESGIndicator/>} />
        <Route path="/sdg" element={<Placeholder title="SDG Progress" />} />
        <Route path="/environmental" element={<Placeholder title="Environmental Indicators" />} />
        <Route path="/social" element={<Placeholder title="Social Indicators" />} />
        <Route path="/data-sources" element={<Placeholder title="Data Sources" />} />
        <Route path="/about" element={<Placeholder title="About Borneo Tracker" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
