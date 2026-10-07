const { Router } = require('express');
const prisma = require('../../lib/prisma');
const { validate } = require('../../middleware/validate');
const {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  DepartmentStatusSchema,
} = require('../../schemas/admin');
const { Errors } = require('../../helpers/errors');

const router = Router();

/**
 * Case-insensitive uniqueness check for department name.
 * Excludes the record with excludeId when updating.
 */
async function checkNameUnique(name, excludeId) {
  const normalized = name.trim().toLowerCase();
  const departments = await prisma.department.findMany({
    where: excludeId ? { id: { not: excludeId } } : {},
    select: { id: true, name: true },
  });
  return departments.some((d) => d.name.trim().toLowerCase() === normalized);
}

// GET /api/admin/departments
router.get("/", async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      include: {
        doctors: {
          select: { id: true, name: true, isActive: true },
          orderBy: { name: "asc" },
        },
      },
    });
    res.json(departments);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/departments
router.post("/", validate(CreateDepartmentSchema), async (req, res, next) => {
  try {
    const { name } = req.body;
    const isDuplicate = await checkNameUnique(name, null);
    if (isDuplicate) {
      const err = Errors.DEPARTMENT_NAME_TAKEN();
      return res.status(err.status).json({ error: { code: err.code, message: err.message, field: err.field } });
    }
    const department = await prisma.department.create({ data: { name: name.trim() } });
    res.status(201).json(department);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/departments/:id
router.patch("/:id", validate(UpdateDepartmentSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      const err = Errors.DEPARTMENT_NOT_FOUND();
      return res.status(err.status).json({ error: { code: err.code, message: err.message, field: null } });
    }
    if (name !== undefined) {
      const isDuplicate = await checkNameUnique(name, id);
      if (isDuplicate) {
        const err = Errors.DEPARTMENT_NAME_TAKEN();
        return res.status(err.status).json({ error: { code: err.code, message: err.message, field: err.field } });
      }
    }
    const department = await prisma.department.update({
      where: { id },
      data: name !== undefined ? { name: name.trim() } : {},
    });
    res.json(department);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/departments/:id/status
router.patch("/:id/status", validate(DepartmentStatusSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      const err = Errors.DEPARTMENT_NOT_FOUND();
      return res.status(err.status).json({ error: { code: err.code, message: err.message, field: null } });
    }
    const department = await prisma.department.update({ where: { id }, data: { isActive } });
    res.json(department);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
