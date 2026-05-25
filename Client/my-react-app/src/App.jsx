import { useEffect, useState } from "react";
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
import PendingReviews from "./pages/PendingReviews";
import ReviewRecord from "./pages/ReviewRecord";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminCodes from "./pages/AdminCodes";
import { getMe } from "./services/api";

function Layout({ children }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function HomeRedirect() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    getMe()
      .then((res) => {
        if (res?.user) {
          setStatus("authed");
        } else {
          setStatus("anon");
        }
      })
      .catch(() => setStatus("anon"));
  }, []);

  if (status === "loading") {
    return null;
  }

  return status === "authed" ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/signin" replace />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth pages — no sidebar */}
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* Dashboard pages — wrapped in sidebar */}
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/dashboard" element={<Layout><DashboardHome /></Layout>} />
        <Route path="/records" element={<Layout><RecordsPage /></Layout>} />
        <Route path="/records/:id" element={<Layout><RecordDetail /></Layout>} />
        <Route path="/upload" element={<Layout><UploadPage /></Layout>} />
        <Route path="/patients" element={<Layout><PatientsPage /></Layout>} />
        <Route path="/patients/create" element={<Layout><CreatePatient /></Layout>} />
        <Route path="/pending" element={<Layout><PendingReviews /></Layout>} />
        <Route path="/review/:id" element={<Layout><ReviewRecord /></Layout>} />
        <Route path="/admin" element={<Layout><AdminDashboard /></Layout>} />
        <Route path="/admin/users" element={<Layout><AdminUsers /></Layout>} />
        <Route path="/admin/codes" element={<Layout><AdminCodes /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}