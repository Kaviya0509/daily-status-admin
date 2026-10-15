import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DailyTrackerPage from "@/pages/DailyTrackerPage";
import ReportDetailsPage from "@/pages/ReportDetailsPage";
import AdminLayout from "@/components/AdminLayout";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/tracker"
          element={
            <AdminLayout>
              <DailyTrackerPage />
            </AdminLayout>
          }
        />
        <Route
          path="/reports/:reportId"
          element={
            <AdminLayout>
              <ReportDetailsPage />
            </AdminLayout>
          }
        />
        <Route path="/" element={<Navigate to="/tracker" replace />} />
        <Route path="*" element={<Navigate to="/tracker" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
