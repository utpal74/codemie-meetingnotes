import { useEffect, useState } from 'react';
import { format, addDays } from 'date-fns';
import api from '../api/client';
import SmsBanner from './SmsBanner';

const today = () => format(new Date(), 'yyyy-MM-dd');

function isWeekday(dateStr) {
  return new Date(dateStr).getUTCDay() !== 0;
}

export default function BookingForm() {
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({
    patientName: '',
    patientPhone: '',
    departmentId: '',
    doctorId: '',
    appointmentDate: today(),
    slotTime: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [smsStatus, setSmsStatus] = useState(null);

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.departmentId) { setDoctors([]); return; }
    api.get('/doctors', { params: { departmentId: form.departmentId } })
      .then((res) => setDoctors(res.data))
      .catch(() => {});
  }, [form.departmentId]);

  useEffect(() => {
    if (!form.doctorId || !form.appointmentDate || !isWeekday(form.appointmentDate)) {
      setSlots([]);
      return;
    }
    api.get('/slots', { params: { doctorId: form.doctorId, date: form.appointmentDate } })
      .then((res) => setSlots(res.data.availableSlots || []))
      .catch(() => setSlots([]));
  }, [form.doctorId, form.appointmentDate]);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const res = await api.post('/appointments', {
        patientName: form.patientName,
        patientPhone: form.patientPhone,
        doctorId: form.doctorId,
        appointmentDate: form.appointmentDate,
        slotTime: form.slotTime,
      });
      setConfirmation(res.data);
      setSmsStatus(res.data.smsStatus);
      setForm({ patientName: '', patientPhone: '', departmentId: '', doctorId: '', appointmentDate: today(), slotTime: '' });
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      else setErrors({ _global: err.message });
    } finally {
      setLoading(false);
    }
  };

  const field = (name, label, type = 'text', props = {}) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        type={type}
        required
        value={form[name]}
        onChange={(e) => set(name, e.target.value)}
        className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[name] ? 'border-red-400' : 'border-gray-300'}`}
        {...props}
      />
      {errors[name] && <p className="text-xs text-red-600 mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {confirmation && (
        <div className="rounded-lg bg-green-50 border border-green-300 p-5">
          <h3 className="font-semibold text-green-800 text-base mb-2">Appointment Confirmed ✓</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-green-900">
            <dt className="font-medium">Appointment ID</dt><dd className="font-mono">{confirmation.appointmentId}</dd>
            <dt className="font-medium">Patient</dt><dd>{confirmation.patientName}</dd>
            <dt className="font-medium">Doctor</dt><dd>{confirmation.doctor}</dd>
            <dt className="font-medium">Department</dt><dd>{confirmation.department}</dd>
            <dt className="font-medium">Date</dt><dd>{new Date(confirmation.appointmentDate).toLocaleDateString('en-IN')}</dd>
            <dt className="font-medium">Time</dt><dd>{confirmation.slotTime}</dd>
          </dl>
          <SmsBanner smsStatus={smsStatus} onDismiss={() => setSmsStatus(null)} />
          <button onClick={() => setConfirmation(null)} className="mt-3 text-sm text-green-700 underline">
            Book another
          </button>
        </div>
      )}

      {!confirmation && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors._global && (
            <div className="rounded bg-red-50 border border-red-300 px-3 py-2 text-red-700 text-sm">{errors._global}</div>
          )}

          {field('patientName', 'Patient Name', 'text', { placeholder: 'Full name' })}
          {field('patientPhone', 'Phone Number', 'tel', { placeholder: '9876543210', maxLength: 10 })}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
            <select
              required
              value={form.departmentId}
              onChange={(e) => { set('departmentId', e.target.value); set('doctorId', ''); set('slotTime', ''); }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doctor <span className="text-red-500">*</span></label>
            <select
              required
              value={form.doctorId}
              disabled={!form.departmentId}
              onChange={(e) => { set('doctorId', e.target.value); set('slotTime', ''); }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">Select doctor</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              required
              min={today()}
              value={form.appointmentDate}
              onChange={(e) => { set('appointmentDate', e.target.value); set('slotTime', ''); }}
              className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.appointmentDate ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.appointmentDate && <p className="text-xs text-red-600 mt-1">{errors.appointmentDate}</p>}
            {form.appointmentDate && !isWeekday(form.appointmentDate) && (
              <p className="text-xs text-amber-600 mt-1">Sundays are not available. Please pick another date.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Slot <span className="text-red-500">*</span></label>
            <select
              required
              value={form.slotTime}
              disabled={!slots.length}
              onChange={(e) => set('slotTime', e.target.value)}
              className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.slotTime ? 'border-red-400' : 'border-gray-300'}`}
            >
              <option value="">{slots.length ? 'Select a slot' : 'Select doctor & date first'}</option>
              {slots.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.slotTime && <p className="text-xs text-red-600 mt-1">{errors.slotTime}</p>}
            {form.doctorId && form.appointmentDate && isWeekday(form.appointmentDate) && slots.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No slots available for this doctor on this date.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
          >
            {loading ? 'Booking…' : 'Confirm Appointment'}
          </button>
        </form>
      )}
    </div>
  );
}
