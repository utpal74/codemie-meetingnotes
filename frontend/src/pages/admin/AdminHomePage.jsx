import { Link } from 'react-router-dom';

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Admin Configuration</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/admin/departments"
          className="block rounded-lg border bg-white p-5 hover:shadow-sm transition"
        >
          <div className="text-lg font-medium text-gray-900">Manage Departments</div>
          <div className="text-sm text-gray-600 mt-1">Create, rename, activate/deactivate</div>
        </Link>

        <Link
          to="/admin/doctors"
          className="block rounded-lg border bg-white p-5 hover:shadow-sm transition"
        >
          <div className="text-lg font-medium text-gray-900">Manage Doctors</div>
          <div className="text-sm text-gray-600 mt-1">Create, edit department, activate/deactivate</div>
        </Link>
      </div>
    </div>
  );
}
