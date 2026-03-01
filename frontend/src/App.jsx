import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import OrganizationDashboard from './pages/OrganizationDashboard';
import UserDashboard from './pages/UserDashboard';

// Protected Route Component
function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // Redirect to appropriate dashboard
    if (user.role === 'SUPER_ADMIN') {
      return <Navigate to="/admin" replace />;
    } else if (user.role === 'ORG_ADMIN') {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/projects" replace />;
    }
  }

  return children;
}

// Public Route (redirect if already logged in)
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (user) {
    // Redirect based on role
    if (user.role === 'SUPER_ADMIN') {
      return <Navigate to="/admin" replace />;
    } else if (user.role === 'ORG_ADMIN') {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/projects" replace />;
    }
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          {/* Super Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="SUPER_ADMIN">
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Organization Admin Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredRole="ORG_ADMIN">
                <OrganizationDashboard />
              </ProtectedRoute>
            }
          />

          {/* User Routes */}
          <Route
            path="/projects"
            element={
              <ProtectedRoute requiredRole="USER">
                <UserDashboard />
              </ProtectedRoute>
            }
          />

          {/* Default Route */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* 404 Route */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
