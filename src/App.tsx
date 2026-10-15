import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLoginPage from "@/pages/AdminLoginPage";
import DailyTrackerPage from "@/pages/DailyTrackerPage";
import ReportDetailsPage from "@/pages/ReportDetailsPage";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import AdminLayout from "@/components/AdminLayout";

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <AdminProtectedRoute>
      <AdminLayout>{children}</AdminLayout>
    </AdminProtectedRoute>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route
          path="/tracker"
          element={
            <ProtectedPage>
              <DailyTrackerPage />
            </ProtectedPage>
          }
        />
        <Route
          path="/reports/:reportId"
          element={
            <ProtectedPage>
              <ReportDetailsPage />
            </ProtectedPage>
          }
        />
        <Route path="/" element={<Navigate to="/tracker" replace />} />
        <Route path="*" element={<Navigate to="/tracker" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
