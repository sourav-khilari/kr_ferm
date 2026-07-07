import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Owners from './pages/Owners';
import Trucks from './pages/Trucks';
import Upload from './pages/Upload';
import Preview from './pages/Preview';
import History from './pages/History';
import UploadPreview from './pages/UploadPreview';
import UploadedData from './pages/UploadedData';
import UploadHistory from './pages/UploadHistory';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/owners" element={<Owners />} />
          <Route path="/trucks" element={<Trucks />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/upload/preview" element={<UploadPreview />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="/uploaded-data" element={<UploadedData />} />
          <Route path="/history" element={<UploadHistory />} />
          {/* Keep old history route redirecting to new one */}
          <Route path="/upload-history" element={<UploadHistory />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
