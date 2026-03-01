import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { projectAPI } from '../services/api';
import { FiFolder, FiUsers } from 'react-icons/fi';

function UserDashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await projectAPI.getProjects();
      setProjects(response.data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
              <p className="text-sm text-gray-600">{user?.organizationName}</p>
            </div>
            <button onClick={logout} className="btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {projects.length === 0 ? (
          <div className="card text-center py-12">
            <FiFolder className="mx-auto text-gray-400 text-5xl mb-4" />
            <p className="text-gray-500 text-lg">No projects assigned yet</p>
            <p className="text-gray-400 text-sm mt-2">
              Contact your admin to get added to projects
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div key={project._id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <FiFolder className="text-primary-600 text-2xl mr-3" />
                    <h3 className="font-semibold text-gray-900">{project.name}</h3>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    {project.status}
                  </span>
                </div>
                
                {project.description && (
                  <p className="text-sm text-gray-600 mb-4">{project.description}</p>
                )}
                
                <div className="flex items-center text-sm text-gray-500">
                  <FiUsers className="mr-2" />
                  {project.members?.length || 0} team members
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default UserDashboard;
