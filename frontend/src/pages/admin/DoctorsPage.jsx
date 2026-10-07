import { useEffect, useMemo, useState } from 'react';
import api from '../../api/client';

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md rounded-lg bg-white shadow">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editDoctor, setEditDoctor] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDeptId, setFormDeptId] = useState('');
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true);
    const [docRes, deptRes] = await Promise.all([
      api.get('/admin/doctors'),
      api.get('/admin/departments'),
    ]);
    setDoctors(docRes.data);
    setDepartments(deptRes.data);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return doctors
      .filter((d) => {
        if (deptFilter && d.departmentId !== deptFilter) return false;
        if (statusFilter === 'active' && !d.isActive) return false;
        if (statusFilter === 'inactive' && d.isActive) return false;
        if (!q) return true;
        return (
          d.name.toLowerCase().includes(q) ||
          d.department?.name?.toLowerCase().includes(q)
        );
      });
  }, [doctors, search, deptFilter, statusFilter]);

  const openCreate = () => {
    setFormName('');
    setFormDeptId(departments[0]?.id || '');
    setFormError('');
    setShowCreate(true);
  };

  const openEdit = (d) => {
    setEditDoctor(d);
    setFormName(d.name);
    setFormDeptId(d.departmentId);
    setFormError('');
  };

  const saveCreate = async () => {
    setFormError('');
    try {
      await api.post('/admin/doctors', { name: formName, departmentId: formDeptId });
      setShowCreate(false);
      await load();
    } catch (e) {
      const code = e?.response?.data?.error?.code;
      if (code === 'DEPARTMENT_NOT_FOUND') setFormError('Department not found.');
      else setFormError('Failed to create doctor.');
    }
  };

  const saveEdit = async () => {
    setFormError('');
    try {
      await api.patch(`/admin/doctors/${editDoctor.id}`, { name: formName, departmentId: formDeptId });
      setEditDoctor(null);
      await load();
    } catch (e) {
      const code = e?.response?.data?.error?.code;
      if (code === 'DEPARTMENT_NOT_FOUND') setFormError('Department not found.');
      else setFormError('Failed to update doctor.');
    }
  };

  const toggleStatus = async (d) => {
    try {
      await api.patch(`/admin/doctors/${d.id}/status`, { isActive: !d.isActive });
      await load();
    } catch (e) {
      const code = e?.response?.data?.error?.code;
      if (code === 'DEPARTMENT_INACTIVE') {
        alert('Cannot activate a doctor while the department is inactive.');
        return;
      }
      alert('Failed to update status.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Doctors</h1>
        <button
          onClick={openCreate}
          className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          + New
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-md border px-3 py-2 bg-white"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border px-3 py-2 bg-white"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search doctors…"
          className="rounded-md border px-3 py-2 bg-white"
        />
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left font-medium px-4 py-3">Name</th>
                <th className="text-left font-medium px-4 py-3">Department</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-right font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-3">{d.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{d.department?.name || '—'}</span>
                      {d.department && !d.department.isActive && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs">
                          Dept inactive
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        d.isActive
                          ? 'inline-flex items-center rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs'
                          : 'inline-flex items-center rounded-full bg-gray-100 text-gray-800 px-2 py-0.5 text-xs'
                      }
                    >
                      {d.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(d)}
                        className="px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleStatus(d)}
                        className={
                          d.isActive
                            ? 'px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm hover:bg-amber-700'
                            : 'px-3 py-1.5 rounded-md bg-green-600 text-white text-sm hover:bg-green-700'
                        }
                      >
                        {d.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>
                    No doctors found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="New Doctor" onClose={() => setShowCreate(false)}>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />

          <label className="block text-sm font-medium text-gray-700 mt-3">Department</label>
          <select
            value={formDeptId}
            onChange={(e) => setFormDeptId(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 bg-white"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}{d.isActive ? '' : ' (inactive)'}</option>
            ))}
          </select>

          {formError && <div className="text-sm text-red-600 mt-2">{formError}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-3 py-2 rounded-md border">
              Cancel
            </button>
            <button onClick={saveCreate} className="px-3 py-2 rounded-md bg-blue-600 text-white">
              Save
            </button>
          </div>
        </Modal>
      )}

      {editDoctor && (
        <Modal title="Edit Doctor" onClose={() => setEditDoctor(null)}>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />

          <label className="block text-sm font-medium text-gray-700 mt-3">Department</label>
          <select
            value={formDeptId}
            onChange={(e) => setFormDeptId(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 bg-white"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}{d.isActive ? '' : ' (inactive)'}</option>
            ))}
          </select>

          {formError && <div className="text-sm text-red-600 mt-2">{formError}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setEditDoctor(null)} className="px-3 py-2 rounded-md border">
              Cancel
            </button>
            <button onClick={saveEdit} className="px-3 py-2 rounded-md bg-blue-600 text-white">
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
