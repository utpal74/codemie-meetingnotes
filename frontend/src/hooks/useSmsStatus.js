import { useEffect, useState } from 'react';
import api from '../api/client';

const POLL_MS = 15000;
const MAX_POLLS = 60;
const SERVER_TO_UI = { SENT: 'SENT', FAILED: 'FAILED', PENDING: 'PENDING_RETRY' };

// Starts from the status returned by the booking/cancel/reschedule call and, while delivery is
// unresolved (FAILED / PENDING_RETRY), polls GET /appointments/:id/sms until it succeeds or
// fails after the backend's retry attempts.
export default function useSmsStatus(appointmentId, initialStatus) {
  const [state, setState] = useState({ smsStatus: initialStatus, failedAfterRetries: false });

  useEffect(() => {
    setState({ smsStatus: initialStatus, failedAfterRetries: false });
    if (!appointmentId || !['FAILED', 'PENDING_RETRY'].includes(initialStatus)) return undefined;

    let polls = 0;
    let cancelled = false;
    const timer = setInterval(async () => {
      polls += 1;
      try {
        const { data } = await api.get(`/appointments/${appointmentId}/sms`);
        if (cancelled) return;
        const status = data.latest ? SERVER_TO_UI[data.latest.status] : null;
        if (status) setState({ smsStatus: status, failedAfterRetries: data.failedAfterRetries });
        if (data.failedAfterRetries || status === 'SENT') clearInterval(timer);
      } catch {
        // transient errors: keep polling until MAX_POLLS
      }
      if (polls >= MAX_POLLS) clearInterval(timer);
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [appointmentId, initialStatus]);

  return state;
}
