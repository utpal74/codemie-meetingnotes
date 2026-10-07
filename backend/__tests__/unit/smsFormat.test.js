const { interpolate, formatDate, formatTime } = require('../../src/helpers/smsFormat');

describe('smsFormat helpers', () => {
  describe('interpolate()', () => {
    test('replaces all known placeholders', () => {
      const tpl = 'Dear {patientName}, your slot is {time} on {date}.';
      expect(interpolate(tpl, { patientName: 'Ravi', time: '02:30 PM', date: '25-09-2026' }))
        .toBe('Dear Ravi, your slot is 02:30 PM on 25-09-2026.');
    });

    test('leaves unknown placeholders intact', () => {
      expect(interpolate('ID: {appointmentId}', {})).toBe('ID: {appointmentId}');
    });

    test('handles template with no placeholders', () => {
      expect(interpolate('Hello World', {})).toBe('Hello World');
    });

    test('replaces multiple occurrences of the same placeholder', () => {
      expect(interpolate('{x} and {x}', { x: 'A' })).toBe('A and A');
    });
  });

  describe('formatDate()', () => {
    test('formats a UTC date string as DD-MM-YYYY', () => {
      expect(formatDate('2026-09-25')).toBe('25-09-2026');
    });

    test('zero-pads single-digit day and month', () => {
      expect(formatDate('2026-01-05')).toBe('05-01-2026');
    });

    test('accepts a Date object', () => {
      expect(formatDate(new Date('2026-12-31T00:00:00Z'))).toBe('31-12-2026');
    });
  });

  describe('formatTime()', () => {
    test('10:00 → 10:00 AM', () => {
      expect(formatTime('10:00')).toBe('10:00 AM');
    });

    test('12:00 → 12:00 PM (noon, not 00:00 PM)', () => {
      expect(formatTime('12:00')).toBe('12:00 PM');
    });

    test('13:30 → 01:30 PM', () => {
      expect(formatTime('13:30')).toBe('01:30 PM');
    });

    test('18:30 → 06:30 PM', () => {
      expect(formatTime('18:30')).toBe('06:30 PM');
    });

    test('00:00 → 12:00 AM (midnight)', () => {
      expect(formatTime('00:00')).toBe('12:00 AM');
    });

    test('00:30 → 12:30 AM', () => {
      expect(formatTime('00:30')).toBe('12:30 AM');
    });

    test('11:30 → 11:30 AM', () => {
      expect(formatTime('11:30')).toBe('11:30 AM');
    });
  });
});
