const { z } = require('zod');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Department schemas
const CreateDepartmentSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
});

const UpdateDepartmentSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters').optional(),
});

const DepartmentStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive is required', invalid_type_error: 'isActive must be a boolean' }),
});

// Doctor schemas
const CreateDoctorSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  departmentId: z.string().regex(UUID_REGEX, 'Invalid department ID'),
});

const UpdateDoctorSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters').optional(),
  departmentId: z.string().regex(UUID_REGEX, 'Invalid department ID').optional(),
});

const DoctorStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive is required', invalid_type_error: 'isActive must be a boolean' }),
});

module.exports = {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  DepartmentStatusSchema,
  CreateDoctorSchema,
  UpdateDoctorSchema,
  DoctorStatusSchema,
};
