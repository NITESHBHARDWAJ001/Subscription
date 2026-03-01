import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { FiMail, FiLock, FiUser, FiBriefcase } from 'react-icons/fi';

function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    organizationName: '',
    adminName: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let result;
    if (isLogin) {
      result = await login(formData.email, formData.password);
    } else {
      result = await register({
        organizationName: formData.organizationName,
        email: formData.email,
        password: formData.password,
        adminName: formData.adminName
      });
    }

    setLoading(false);

    if (result.success) {
      // Redirect based on role
      if (result.user.role === 'SUPER_ADMIN') {
        navigate('/admin');
      } else if (result.user.role === 'ORG_ADMIN') {
        navigate('/dashboard');
      } else {
        navigate('/projects');
      }
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isLogin ? 'Welcome Back' : 'Get Started'}
          </h1>
          <p className="text-gray-600">
            {isLogin ? 'Sign in to your account' : 'Create your organization'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="label">
                  <FiBriefcase className="inline mr-2" />
                  Organization Name
                </label>
                <input
                  type="text"
                  name="organizationName"
                  value={formData.organizationName}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">
                  <FiUser className="inline mr-2" />
                  Your Name
                </label>
                <input
                  type="text"
                  name="adminName"
                  value={formData.adminName}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="label">
              <FiMail className="inline mr-2" />
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">
              <FiLock className="inline mr-2" />
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>

        {/* Demo credentials */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center mb-2">Demo Credentials:</p>
          <div className="text-xs text-gray-600 space-y-1">
            <p><strong>Super Admin:</strong> admin@system.local / admin123</p>
            <p><strong>Org Admin:</strong> demo@example.com / demo123</p>
            <p><strong>User:</strong> user@example.com / user123</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
