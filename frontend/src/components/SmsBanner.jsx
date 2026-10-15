import { useEffect, useState } from 'react';
import useSmsStatus from '../hooks/useSmsStatus';

const VARIANTS = {
  SENT: {
    box: 'bg-green-50 border-green-300 text-green-800',
    title: 'SMS sent to the patient',
  },
  PENDING_RETRY: {
    box: 'bg-amber-50 border-amber-300 text-amber-800',
    title: 'Appointment saved — SMS still sending',
    body: 'Delivery is being retried. If it keeps failing, inform the patient verbally.',
  },
  FAILED: {
    box: 'bg-red-50 border-red-300 text-red-800',
    title: 'Appointment saved — SMS not delivered',
    body: 'Please inform the patient verbally of their appointment details.',
  },
  FAILED_AFTER_RETRIES: {
    box: 'bg-red-50 border-red-400 text-red-900',
    title: 'SMS failed after retries — contact patient manually',
    body: 'Automatic retries are exhausted. The patient has not been notified.',
  },
  DISABLED: {
    box: 'bg-gray-50 border-gray-300 text-gray-700',
    title: 'SMS notifications are disabled',
    body: 'No message was sent. Inform the patient verbally.',
  },
};

export default function SmsBanner({ smsStatus, failedAfterRetries = false, onDismiss }) {
  if (!smsStatus) return null;

  const key = failedAfterRetries ? 'FAILED_AFTER_RETRIES' : smsStatus;
  const variant = VARIANTS[key] || VARIANTS.FAILED;

  return (
    <div
      role={failedAfterRetries ? 'alert' : 'status'}
      data-testid="sms-banner"
      data-sms-state={key}
      className={`flex items-start gap-3 rounded-md border p-4 text-sm ${variant.box}`}
    >
      <div className="flex-1">
        <p className="font-medium">{variant.title}</p>
        {variant.body && <p className="mt-0.5">{variant.body}</p>}
        <p className="mt-0.5 text-xs opacity-75">Status: {smsStatus}</p>
      </div>
      {onDismiss && !failedAfterRetries && (
        <button onClick={onDismiss} aria-label="Dismiss" className="font-bold text-lg leading-none opacity-70 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  );
}

export function SmsStatusBanner({ appointmentId, initialStatus }) {
  const { smsStatus, failedAfterRetries } = useSmsStatus(appointmentId, initialStatus);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { setDismissed(false); }, [appointmentId]);
  // A newly detected permanent failure must always be visible.
  useEffect(() => { if (failedAfterRetries) setDismissed(false); }, [failedAfterRetries]);

  if (dismissed) return null;
  return (
    <SmsBanner
      smsStatus={smsStatus}
      failedAfterRetries={failedAfterRetries}
      onDismiss={() => setDismissed(true)}
    />
  );
}
