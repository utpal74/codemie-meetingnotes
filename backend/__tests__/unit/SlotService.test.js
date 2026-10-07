const { generateAllSlots, assignRandomSlot, validateSlot } = require('../../src/services/SlotService');

describe('SlotService — pure functions', () => {
  describe('generateAllSlots()', () => {
    let slots;
    beforeAll(() => { slots = generateAllSlots(); });

    test('returns exactly 18 slots', () => {
      expect(slots).toHaveLength(18);
    });

    test('first slot is 10:00', () => {
      expect(slots[0]).toBe('10:00');
    });

    test('last slot is 18:30', () => {
      expect(slots[slots.length - 1]).toBe('18:30');
    });

    test('all slots are in HH:MM format', () => {
      slots.forEach(s => expect(s).toMatch(/^\d{2}:\d{2}$/));
    });

    test('slots increment by 30 minutes', () => {
      for (let i = 1; i < slots.length; i++) {
        const [ph, pm] = slots[i - 1].split(':').map(Number);
        const [ch, cm] = slots[i].split(':').map(Number);
        const prevMins = ph * 60 + pm;
        const currMins = ch * 60 + cm;
        expect(currMins - prevMins).toBe(30);
      }
    });

    test('does not include 19:00 or later', () => {
      slots.forEach(s => {
        const [h] = s.split(':').map(Number);
        expect(h).toBeLessThan(19);
      });
    });

    test('does not include 09:30 or earlier', () => {
      slots.forEach(s => {
        const [h] = s.split(':').map(Number);
        expect(h).toBeGreaterThanOrEqual(10);
      });
    });
  });

  describe('validateSlot()', () => {
    test('returns true for every generated slot', () => {
      generateAllSlots().forEach(s => expect(validateSlot(s)).toBe(true));
    });

    test('returns false for 09:30 (before clinic hours)', () => {
      expect(validateSlot('09:30')).toBe(false);
    });

    test('returns false for 19:00 (after clinic hours)', () => {
      expect(validateSlot('19:00')).toBe(false);
    });

    test('returns false for 14:15 (non-30-min boundary)', () => {
      expect(validateSlot('14:15')).toBe(false);
    });

    test('returns false for empty string', () => {
      expect(validateSlot('')).toBe(false);
    });
  });

  describe('assignRandomSlot()', () => {
    test('returns null for empty array', () => {
      expect(assignRandomSlot([])).toBeNull();
    });

    test('returns the only element when array has one item', () => {
      expect(assignRandomSlot(['14:00'])).toBe('14:00');
    });

    test('always returns an element from the input array', () => {
      const slots = ['10:00', '11:30', '15:00'];
      for (let i = 0; i < 50; i++) {
        expect(slots).toContain(assignRandomSlot(slots));
      }
    });
  });
});
