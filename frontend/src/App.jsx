import React from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import PlatformAdminLogin from "./pages/PlatformAdminLogin";
import VerifyCertificate from "./pages/VerifyCertificate";
import ScanCertificate from "./pages/ScanCertificate";
import NotFound from "./pages/NotFound";

import InstitutionDashboard from "./pages/institution/Dashboard";
import IssueCertificate from "./pages/institution/IssueCertificate";
import BulkIssueCertificates from "./pages/institution/BulkIssueCertificates";
import CertificateDetail from "./pages/institution/CertificateDetail";

import StudentPortal from "./pages/student/StudentPortal";

import AdminDashboard from "./pages/admin/AdminDashboard";
import OnboardInstitution from "./pages/admin/OnboardInstitution";
import InstitutionDetail from "./pages/admin/InstitutionDetail";
import AuditLog from "./pages/admin/AuditLog";
import ActivityLog from "./pages/institution/ActivityLog";

// Keep this route private and rename it before deployment; it is never linked from the UI.
const PLATFORM_ADMIN_LOGIN_ROUTE = "/platform-admin-access";

export default function App() {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path={PLATFORM_ADMIN_LOGIN_ROUTE} element={<PlatformAdminLogin />} />
            <Route path="/verify" element={<VerifyCertificate />} />
            <Route path="/verify/:certificateId" element={<VerifyCertificate />} />
            <Route path="/scan" element={<ScanCertificate />} />

            <Route
              path="/institution"
              element={
                <ProtectedRoute roles={["institution_staff"]}>
                  <InstitutionDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/institution/issue"
              element={
                <ProtectedRoute roles={["institution_staff"]}>
                  <IssueCertificate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/institution/bulk-issue"
              element={
                <ProtectedRoute roles={["institution_staff"]}>
                  <BulkIssueCertificates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/institution/certificates/:certificateId"
              element={
                <ProtectedRoute roles={["institution_staff"]}>
                  <CertificateDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/institution/activity"
              element={<ProtectedRoute roles={["institution_staff"]}><ActivityLog /></ProtectedRoute>}
            />

            <Route
              path="/student"
              element={
                <ProtectedRoute roles={["student"]}>
                  <StudentPortal />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={["platform_admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/onboard"
              element={
                <ProtectedRoute roles={["platform_admin"]}>
                  <OnboardInstitution />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/institutions/:id"
              element={
                <ProtectedRoute roles={["platform_admin"]}>
                  <InstitutionDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit"
              element={<ProtectedRoute roles={["platform_admin"]}><AuditLog /></ProtectedRoute>}
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
