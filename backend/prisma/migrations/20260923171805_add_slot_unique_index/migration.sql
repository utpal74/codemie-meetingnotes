-- CR-03: Move the partial unique slot index from seed.js into migration
-- so it is applied in ALL environments via 'prisma migrate deploy', not only on seed.
CREATE UNIQUE INDEX IF NOT EXISTS "UX_appt_slot"
  ON "Appointment"("doctorId", "appointmentDate", "slotTime")
  WHERE (status = 'CONFIRMED');