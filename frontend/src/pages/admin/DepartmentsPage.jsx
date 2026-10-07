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

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editDept, setEditDept] = useState(null);

  const [formName, setFormName] = useState('');
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await api.get('/admin/departments');
    setDepartments(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, search]);

  const openCreate = () => {
    setFormName('');
    setFormError('');
    setShowCreate(true);
  };

  const openEdit = (d) => {
    setEditDept(d);
    setFormName(d.name);
    setFormError('');
  };

  const saveCreate = async () => {
    setFormError('');
    try {
      await api.post('/admin/departments', { name: formName });
      setShowCreate(false);
      await load();
    } catch (e) {
      const code = e?.response?.data?.error?.code;
      if (code === 'DEPARTMENT_NAME_TAKEN') setFormError('Department name already exists.');
      else setFormError('Failed to create department.');
    }
  };

  const saveEdit = async () => {
    setFormError('');
    try {
      await api.patch(`/admin/departments/${editDept.id}`, { name: formName });
      setEditDept(null);
      await load();
    } catch (e) {
      const code = e?.response?.data?.error?.code;
      if (code === 'DEPARTMENT_NAME_TAKEN') setFormError('Department name already exists.');
      else setFormError('Failed to update department.');
    }
  };

  const toggleStatus = async (d) => {
    await api.patch(`/admin/departments/${d.id}/status`, { isActive: !d.isActive });
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Departments</h1>
        <button
          onClick={openCreate}
          className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          + New
        </button>
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search departments…"
          className="w-full rounded-md border px-3 py-2 bg-white"
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
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-right font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-3">{d.name}</td>
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
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={3}>
                    No departments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="New Department" onClose={() => setShowCreate(false)}>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
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

      {editDept && (
        <Modal title="Edit Department" onClose={() => setEditDept(null)}>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
          {formError && <div className="text-sm text-red-600 mt-2">{formError}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setEditDept(null)} className="px-3 py-2 rounded-md border">
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
