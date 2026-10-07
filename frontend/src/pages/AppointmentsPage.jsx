import { useState } from 'react';
import AppointmentList from '../components/AppointmentList';
import CancelReschedule from '../components/CancelReschedule';

export default function AppointmentsPage() {
  const [selected, setSelected] = useState(null);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Find Appointment</h2>
      {selected ? (
        <CancelReschedule appointment={selected} onDone={() => setSelected(null)} />
      ) : (
        <AppointmentList onSelect={setSelected} />
      )}
    </div>
  );
}
