const {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  DepartmentStatusSchema,
  CreateDoctorSchema,
  UpdateDoctorSchema,
  DoctorStatusSchema,
} = require('../../src/schemas/admin');

describe('admin zod schemas', () => {
  test('CreateDepartmentSchema accepts trimmed name', () => {
    const r = CreateDepartmentSchema.safeParse({ name: '  Cardiology  ' });
    expect(r.success).toBe(true);
  });

  test('CreateDepartmentSchema rejects short name', () => {
    const r = CreateDepartmentSchema.safeParse({ name: 'A' });
    expect(r.success).toBe(false);
  });

  test('UpdateDepartmentSchema allows empty payload', () => {
    const r = UpdateDepartmentSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  test('DepartmentStatusSchema requires boolean', () => {
    expect(DepartmentStatusSchema.safeParse({ isActive: true }).success).toBe(true);
    expect(DepartmentStatusSchema.safeParse({ isActive: 'true' }).success).toBe(false);
  });

  test('CreateDoctorSchema requires uuid departmentId', () => {
    const ok = CreateDoctorSchema.safeParse({
      name: 'Dr X',
      departmentId: '00000000-0000-0000-0000-000000000001',
    });
    expect(ok.success).toBe(true);

    const bad = CreateDoctorSchema.safeParse({ name: 'Dr X', departmentId: 'not-a-uuid' });
    expect(bad.success).toBe(false);
  });

  test('UpdateDoctorSchema allows partial', () => {
    expect(UpdateDoctorSchema.safeParse({ name: 'Dr Y' }).success).toBe(true);
    expect(UpdateDoctorSchema.safeParse({ departmentId: '00000000-0000-0000-0000-000000000001' }).success).toBe(true);
  });

  test('DoctorStatusSchema requires boolean', () => {
    expect(DoctorStatusSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(DoctorStatusSchema.safeParse({ isActive: 0 }).success).toBe(false);
  });
});
