import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import api from '../api/client';
import { AppointmentCard } from './AppointmentList';
import SmsBanner from './SmsBanner';

const today = () => format(new Date(), 'yyyy-MM-dd');

function isWeekday(dateStr) {
  return new Date(dateStr).getUTCDay() !== 0;
}

export default function CancelReschedule({ appointment, onDone }) {
  const [mode, setMode] = useState(null); // 'cancel' | 'reschedule'
  const [slots, setSlots] = useState([]);
  const [rescheduleForm, setRescheduleForm] = useState({
    appointmentDate: today(),
    slotTime: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [smsStatus, setSmsStatus] = useState(null);

  useEffect(() => {
    if (mode !== 'reschedule' || !rescheduleForm.appointmentDate || !isWeekday(rescheduleForm.appointmentDate)) {
      setSlots([]);
      return;
    }
    api.get('/slots', {
      params: {
        doctorId: appointment.doctorId || '',
        date: rescheduleForm.appointmentDate,
      },
    })
      .then((res) => setSlots(res.data.availableSlots || []))
      .catch(() => setSlots([]));
  }, [mode, rescheduleForm.appointmentDate, appointment]);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.patch(`/appointments/${appointment.appointmentId}/cancel`);
      setResult(res.data);
      setSmsStatus(res.data.smsStatus);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.patch(`/appointments/${appointment.appointmentId}/reschedule`, rescheduleForm);
      setResult(res.data);
      setSmsStatus(res.data.smsStatus);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-green-50 border border-green-300 p-4 text-sm">
          <p className="font-semibold text-green-800">
            {result.status === 'CANCELLED' ? 'Appointment Cancelled' : 'Appointment Rescheduled ✓'}
          </p>
          {result.status !== 'CANCELLED' && (
            <p className="text-green-700 mt-1">
              New Appointment ID: <span className="font-mono">{result.appointmentId}</span>
              {' · '}{new Date(result.appointmentDate).toLocaleDateString('en-IN')} at {result.slotTime}
            </p>
          )}
        </div>
        <SmsBanner smsStatus={smsStatus} onDismiss={() => setSmsStatus(null)} />
        <button onClick={onDone} className="text-sm text-blue-600 underline">← Back to search</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AppointmentCard appt={appointment} />

      {error && (
        <div className="rounded bg-red-50 border border-red-300 px-3 py-2 text-red-700 text-sm">{error}</div>
      )}

      {!mode && (
        <div className="flex gap-3">
          <button
            onClick={() => setMode('reschedule')}
            className="flex-1 border border-blue-600 text-blue-600 hover:bg-blue-50 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Reschedule
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 border border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-50 py-2 rounded-md text-sm font-medium transition-colors"
          >
            {loading ? 'Cancelling…' : 'Cancel Appointment'}
          </button>
        </div>
      )}

      {mode === 'reschedule' && (
        <form onSubmit={handleReschedule} className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Select new date & time</p>
          <div>
            <label className="block text-xs text-gray-600 mb-1">New Date</label>
            <input
              type="date"
              required
              min={today()}
              value={rescheduleForm.appointmentDate}
              onChange={(e) => setRescheduleForm({ appointmentDate: e.target.value, slotTime: '' })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {rescheduleForm.appointmentDate && !isWeekday(rescheduleForm.appointmentDate) && (
              <p className="text-xs text-amber-600 mt-1">Sundays are not available.</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">New Time Slot</label>
            <select
              required
              value={rescheduleForm.slotTime}
              disabled={!slots.length}
              onChange={(e) => setRescheduleForm((f) => ({ ...f, slotTime: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">{slots.length ? 'Select a slot' : 'Pick a date first'}</option>
              {slots.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !rescheduleForm.slotTime}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-md text-sm font-medium transition-colors"
            >
              {loading ? 'Rescheduling…' : 'Confirm Reschedule'}
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <button onClick={onDone} className="text-xs text-gray-400 underline">← Back to search</button>
    </div>
  );
}
