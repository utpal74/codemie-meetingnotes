const prisma = require('../lib/prisma');

async function listDepartments() {
  return prisma.department.findMany({
    include: { doctors: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
}

async function listDoctors(departmentId) {
  return prisma.doctor.findMany({
    where: departmentId ? { departmentId } : undefined,
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

module.exports = { listDepartments, listDoctors, getDoctorById };
