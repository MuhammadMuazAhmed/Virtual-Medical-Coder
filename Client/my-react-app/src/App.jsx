import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import RecordsPage from "./pages/Recordspage";
import UploadPage from "./pages/UploadPage";
import RecordDetail from "./pages/RecordDetail";


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RecordsPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/record" element={<RecordDetail />} />
      </Routes>
    </Router>
  );
}

export default App;