import { useState } from 'react';
import api from '../api/client';

const STATUS_COLORS = {
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  RESCHEDULED: 'bg-gray-100 text-gray-600',
};

export function AppointmentCard({ appt, onRefresh }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex justify-between items-start gap-2 mb-3">
        <div>
          <p className="font-semibold text-gray-800">{appt.patientName}</p>
          <p className="text-xs text-gray-400 font-mono">{appt.appointmentId}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[appt.status] || 'bg-gray-100'}`}>
          {appt.status}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700 mb-3">
        <dt className="font-medium">Doctor</dt><dd>{appt.doctor}</dd>
        <dt className="font-medium">Department</dt><dd>{appt.department}</dd>
        <dt className="font-medium">Date</dt><dd>{new Date(appt.appointmentDate).toLocaleDateString('en-IN')}</dd>
        <dt className="font-medium">Time</dt><dd>{appt.slotTime}</dd>
      </dl>
      {onRefresh && appt.status === 'CONFIRMED' && (
        <button onClick={() => onRefresh(appt)} className="text-xs text-blue-600 underline">
          Manage →
        </button>
      )}
    </div>
  );
}

export default function AppointmentList({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError('');
    setLoading(true);
    setResults(null);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(query.trim());
      let data;
      if (isUuid) {
        const res = await api.get(`/appointments/${query.trim()}`);
        data = [res.data];
      } else {
        const res = await api.get('/appointments', { params: { phone: query.trim() } });
        data = res.data;
      }
      setResults(data);
      if (!data.length) setError('No appointments found.');
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Phone number or Appointment ID"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm transition-colors"
        >
          {loading ? '…' : 'Search'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && results.length > 0 && (
        <div className="space-y-3">
          {results.map((appt) => (
            <AppointmentCard key={appt.appointmentId} appt={appt} onRefresh={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
