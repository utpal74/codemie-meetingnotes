import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import BookingPage from './pages/BookingPage';
import AppointmentsPage from './pages/AppointmentsPage';

function Nav() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-700'
    }`;

  return (
    <nav className="bg-blue-600 text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold text-lg">🏥 HealthCare Clinic</span>
        <NavLink to="/" end className={linkClass}>Book Appointment</NavLink>
        <NavLink to="/appointments" className={linkClass}>Find / Manage</NavLink>
      </div>
      <button onClick={handleLogout} className="text-sm text-blue-200 hover:text-white">
        Log out
      </button>
    </nav>
  );
}

export default function App() {
  const { authenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {authenticated && <Nav />}
      <main className="max-w-xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
          <Route path="/appointments" element={<ProtectedRoute><AppointmentsPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}
