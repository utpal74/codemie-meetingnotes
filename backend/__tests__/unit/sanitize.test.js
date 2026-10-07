const { sanitize, maskPhone } = require('../../src/helpers/sanitize');

describe('sanitize helpers', () => {
  describe('maskPhone()', () => {
    test('masks a 10-digit phone number', () => {
      expect(maskPhone('9876543210')).toBe('98****10');
    });

    test('masks keeping first 2 and last 2 chars', () => {
      const masked = maskPhone('1234567890');
      expect(masked.startsWith('12')).toBe(true);
      expect(masked.endsWith('90')).toBe(true);
      expect(masked).toContain('****');
    });

    test('returns **** for strings shorter than 4 chars', () => {
      expect(maskPhone('123')).toBe('****');
      expect(maskPhone('')).toBe('****');
    });

    test('does not expose full number in masked output', () => {
      const masked = maskPhone('9876543210');
      expect(masked).not.toBe('9876543210');
      expect(masked.length).toBeLessThan('9876543210'.length);
    });
  });

  describe('sanitize()', () => {
    test('masks top-level "phone" keys', () => {
      const result = sanitize({ phone: '9876543210' });
      expect(result.phone).not.toBe('9876543210');
      expect(result.phone).toContain('****');
    });

    test('masks "patientPhone" keys', () => {
      const result = sanitize({ patientPhone: '9876543210' });
      expect(result.patientPhone).toContain('****');
    });

    test('masks "mobile" keys', () => {
      const result = sanitize({ mobile: '9876543210' });
      expect(result.mobile).toContain('****');
    });

    test('does not mask unrelated fields', () => {
      const result = sanitize({ name: 'Ravi', doctorId: 'uuid-abc' });
      expect(result.name).toBe('Ravi');
      expect(result.doctorId).toBe('uuid-abc');
    });

    test('masks nested phone fields', () => {
      const result = sanitize({ patient: { patientPhone: '9876543210', name: 'Ravi' } });
      expect(result.patient.patientPhone).toContain('****');
      expect(result.patient.name).toBe('Ravi');
    });

    test('handles arrays', () => {
      const result = sanitize([{ phone: '9876543210' }, { phone: '9111222333' }]);
      expect(result[0].phone).toContain('****');
      expect(result[1].phone).toContain('****');
    });

    test('passes through null without error', () => {
      expect(sanitize(null)).toBeNull();
    });

    test('passes through primitives unchanged', () => {
      expect(sanitize('hello')).toBe('hello');
      expect(sanitize(42)).toBe(42);
    });
  });
});
