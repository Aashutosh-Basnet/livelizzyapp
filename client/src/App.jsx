import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ViewerPage from './components/ViewerPage';
import AdminStreamer from './components/AdminStreamer';
import './App.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <Routes>
          <Route path="/" element={<ViewerPage />} />
          <Route path="/admin-streamer" element={<AdminStreamer />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;