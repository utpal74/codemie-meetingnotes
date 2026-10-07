export default function SmsBanner({ smsStatus, onDismiss }) {
  if (!smsStatus || smsStatus === 'SENT') return null;

  return (
    <div className="flex items-start gap-3 rounded-md bg-amber-50 border border-amber-300 p-4 text-amber-800 text-sm">
      <span className="text-lg leading-none">⚠️</span>
      <div className="flex-1">
        <p className="font-medium">Appointment saved — SMS not delivered</p>
        <p className="mt-0.5">Please inform the patient verbally of their appointment details.</p>
        <p className="mt-0.5 text-xs text-amber-600">Status: {smsStatus}</p>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-amber-600 hover:text-amber-900 font-bold text-lg leading-none">
          ×
        </button>
      )}
    </div>
  );
}
