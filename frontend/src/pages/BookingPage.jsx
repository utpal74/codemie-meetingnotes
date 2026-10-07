import BookingForm from '../components/BookingForm';

export default function BookingPage() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-700 mb-4">New Appointment</h2>
      <BookingForm />
    </div>
  );
}
