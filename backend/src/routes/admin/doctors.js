const { Router } = require('express');
const prisma = require('../../lib/prisma');
const { validate } = require('../../middleware/validate');
const {
  CreateDoctorSchema,
  UpdateDoctorSchema,
  DoctorStatusSchema,
} = require('../../schemas/admin');
const { Errors } = require('../../helpers/errors');

const router = Router();

// GET /api/admin/doctors
router.get("/", async (req, res, next) => {
  try {
    const { departmentId, status } = req.query;
    const where = {};
    if (departmentId) where.departmentId = departmentId;
    if (status === 'active') where.isActive = true;
    else if (status === 'inactive') where.isActive = false;

    const doctors = await prisma.doctor.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { department: { select: { id: true, name: true, isActive: true } } },
    });
    res.json(doctors);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/doctors
router.post("/", validate(CreateDoctorSchema), async (req, res, next) => {
  try {
    const { name, departmentId } = req.body;

    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) {
      const err = Errors.DEPARTMENT_NOT_FOUND();
      return res.status(err.status).json({ error: { code: err.code, message: err.message, field: null } });
    }

    const doctor = await prisma.doctor.create({
      data: { name: name.trim(), departmentId },
      include: { department: { select: { id: true, name: true, isActive: true } } },
    });
    res.status(201).json(doctor);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/doctors/:id
router.patch("/:id", validate(UpdateDoctorSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, departmentId } = req.body;

    const existing = await prisma.doctor.findUnique({ where: { id } });
    if (!existing) {
      const err = Errors.DOCTOR_NOT_FOUND();
      return res.status(err.status).json({ error: { code: err.code, message: err.message, field: null } });
    }

    if (departmentId !== undefined) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) {
        const err = Errors.DEPARTMENT_NOT_FOUND();
        return res.status(err.status).json({ error: { code: err.code, message: err.message, field: null } });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (departmentId !== undefined) updateData.departmentId = departmentId;

    const doctor = await prisma.doctor.update({
      where: { id },
      data: updateData,
      include: { department: { select: { id: true, name: true, isActive: true } } },
    });
    res.json(doctor);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/doctors/:id/status
router.patch("/:id/status", validate(DoctorStatusSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const existing = await prisma.doctor.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!existing) {
      const err = Errors.DOCTOR_NOT_FOUND();
      return res.status(err.status).json({ error: { code: err.code, message: err.message, field: null } });
    }

    // Prevent activating a doctor whose department is inactive
    if (isActive && !existing.department.isActive) {
      const err = Errors.DEPARTMENT_INACTIVE();
      return res.status(err.status).json({ error: { code: err.code, message: err.message, field: err.field } });
    }

    const doctor = await prisma.doctor.update({
      where: { id },
      data: { isActive },
      include: { department: { select: { id: true, name: true, isActive: true } } },
    });
    res.json(doctor);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
