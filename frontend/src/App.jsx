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
import Pumps from './pages/Pumps';
import DieselUpload from './pages/DieselUpload';
import DieselPreview from './pages/DieselPreview';
import DieselData from './pages/DieselData';
import DieselReport from './pages/DieselReport';
import SummaryPreview from './pages/SummaryPreview';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/owners" element={<Owners />} />
          <Route path="/trucks" element={<Trucks />} />
          <Route path="/pumps" element={<Pumps />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/upload/preview" element={<UploadPreview />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="/uploaded-data" element={<UploadedData />} />
          <Route path="/history" element={<UploadHistory />} />
          <Route path="/upload-history" element={<UploadHistory />} />
          <Route path="/diesel-upload" element={<DieselUpload />} />
          <Route path="/diesel/preview" element={<DieselPreview />} />
          <Route path="/diesel-data" element={<DieselData />} />
          <Route path="/diesel-report" element={<DieselReport />} />
          <Route path="/summary-preview" element={<SummaryPreview />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
