import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import RecordsPage from "./pages/Recordspage";
import UploadPage from "./pages/UploadPage";
import CreatePatient from "./pages/CreatePatient";
import RecordDetail from "./pages/RecordDetail";
import PatientsPage from "./pages/PatientsPage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";

function Layout({ children }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth pages — no sidebar */}
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* Dashboard pages — wrapped in sidebar */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Layout><DashboardHome /></Layout>} />
        <Route path="/records" element={<Layout><RecordsPage /></Layout>} />
        <Route path="/records/:id" element={<Layout><RecordDetail /></Layout>} />
        <Route path="/upload" element={<Layout><UploadPage /></Layout>} />
        <Route path="/patients" element={<Layout><PatientsPage /></Layout>} />
        <Route path="/patients/create" element={<Layout><CreatePatient /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}