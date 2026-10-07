const prisma = require('../lib/prisma');

async function listDepartments() {
  return prisma.department.findMany({
    where: { isActive: true },
    include: { doctors: { select: { id: true, name: true }, where: { isActive: true } } },
    orderBy: { name: 'asc' },
  });
}

async function listDoctors(departmentId) {
  return prisma.doctor.findMany({
    where: {
      isActive: true,
      department: { isActive: true },
      ...(departmentId ? { departmentId } : {}),
    },
    include: { department: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
}

async function listActiveDoctors(departmentId) {
  return prisma.doctor.findMany({
    where: {
      isActive: true,
      department: { isActive: true },
      ...(departmentId ? { departmentId } : {}),
    },
    include: { department: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
}

async function getDoctorById(id) {
  return prisma.doctor.findUnique({
    where: { id },
    include: { department: true },
  });
}

/**
 * Used by booking flow to validate doctor is active and department is active.
 */
async function getActiveDoctorById(id) {
  return prisma.doctor.findFirst({
    where: { id, isActive: true, department: { isActive: true } },
    include: { department: true },
  });
}

module.exports = { listDepartments, listDoctors, listActiveDoctors, getDoctorById, getActiveDoctorById };
