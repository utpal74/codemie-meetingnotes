/**
 * Integration tests: Admin Doctors API
 * Story: EPMCDMETST-68125  AC covered: AC8-AC18
 * Run: npx jest tests/integration/admin-doctors.test.js
 */
const request = require("supertest");
const app = require("../../backend/src/app");
const prisma = require("../../backend/src/lib/prisma");

async function loginAsAdmin() {
  const res = await request(app).post("/api/auth/login").send({
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "adminpassword",
  });
  expect(res.status).toBe(200);
  return res.headers["set-cookie"];
}

async function loginAsReceptionist() {
  const res = await request(app).post("/api/auth/login").send({
    username: process.env.RECEPTIONIST_USERNAME || "receptionist",
    password: process.env.RECEPTIONIST_PASSWORD || "receptionistpassword",
  });
  expect(res.status).toBe(200);
  return res.headers["set-cookie"];
}

async function createDept(name, isActive = true) {
  return prisma.department.create({ data: { name, isActive } });
}

async function createDoctor(name, departmentId, isActive = true) {
  return prisma.doctor.create({ data: { name, departmentId, isActive } });
}

const DOCTOR_TEST_NAMES = [
  "Dr. Priya Sharma", "Dr. Rajesh Patel", "Dr. Arun Mehta",
  "Dr. Old Name", "Dr. New Name", "Dr. Ghost", "Dr. Test",
];
const DEPT_TEST_NAMES = ["General Medicine", "Bone Health", "Cardiology"];

let generalMedicine;
let boneHealth;

beforeEach(async () => {
  await prisma.doctor.deleteMany({ where: { name: { in: DOCTOR_TEST_NAMES } } });
  await prisma.department.deleteMany({ where: { name: { in: DEPT_TEST_NAMES } } });
  generalMedicine = await createDept("General Medicine", true);
  boneHealth = await createDept("Bone Health", false);
});

afterAll(async () => { await prisma.$disconnect(); });

// GET /api/admin/doctors ---------------------------------------------------

describe("GET /api/admin/doctors", () => {
  it("[AC1] returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/admin/doctors");
    expect(res.status).toBe(401);
  });

  it("[AC1] returns 403 for RECEPTIONIST role", async () => {
    const cookie = await loginAsReceptionist();
    const res = await request(app).get("/api/admin/doctors").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns all doctors including inactive for ADMIN", async () => {
    const cookie = await loginAsAdmin();
    await createDoctor("Dr. Priya Sharma", generalMedicine.id, true);
    await createDoctor("Dr. Rajesh Patel", generalMedicine.id, false);
    const res = await request(app).get("/api/admin/doctors").set("Cookie", cookie);
    expect(res.status).toBe(200);
    const names = res.body.map((d) => d.name);
    expect(names).toContain("Dr. Priya Sharma");
    expect(names).toContain("Dr. Rajesh Patel");
  });

  it("[AC16] filters by status=active returns only active doctors", async () => {
    const cookie = await loginAsAdmin();
    await createDoctor("Dr. Priya Sharma", generalMedicine.id, true);
    await createDoctor("Dr. Rajesh Patel", generalMedicine.id, false);
    const res = await request(app).get("/api/admin/doctors?status=active").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.every((d) => d.isActive === true)).toBe(true);
    const names = res.body.map((d) => d.name);
    expect(names).toContain("Dr. Priya Sharma");
    expect(names).not.toContain("Dr. Rajesh Patel");
  });

  it("[AC16] filters by status=inactive returns only inactive doctors", async () => {
    const cookie = await loginAsAdmin();
    await createDoctor("Dr. Priya Sharma", generalMedicine.id, true);
    await createDoctor("Dr. Rajesh Patel", generalMedicine.id, false);
    const res = await request(app).get("/api/admin/doctors?status=inactive").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.every((d) => d.isActive === false)).toBe(true);
    const names = res.body.map((d) => d.name);
    expect(names).not.toContain("Dr. Priya Sharma");
    expect(names).toContain("Dr. Rajesh Patel");
  });

  it("[AC17] filters by departmentId", async () => {
    const cookie = await loginAsAdmin();
    const cardiology = await createDept("Cardiology", true);
    await createDoctor("Dr. Priya Sharma", generalMedicine.id, true);
    await createDoctor("Dr. Arun Mehta", cardiology.id, true);
    const res = await request(app)
      .get("/api/admin/doctors?departmentId=" + cardiology.id)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    const names = res.body.map((d) => d.name);
    expect(names).toContain("Dr. Arun Mehta");
    expect(names).not.toContain("Dr. Priya Sharma");
    expect(res.body.every((d) => d.departmentId === cardiology.id)).toBe(true);
  });
});

// POST /api/admin/doctors ---------------------------------------------------

describe("POST /api/admin/doctors", () => {
  it("[AC8] creates a doctor with valid name and department", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .post("/api/admin/doctors")
      .set("Cookie", cookie)
      .send({ name: "Dr. Priya Sharma", departmentId: generalMedicine.id });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Dr. Priya Sharma");
    expect(res.body.isActive).toBe(true);
    expect(res.body.department).toBeDefined();
    expect(res.body.department.id).toBe(generalMedicine.id);
  });

  it("[AC9] returns 404 DEPARTMENT_NOT_FOUND for non-existent departmentId", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .post("/api/admin/doctors")
      .set("Cookie", cookie)
      .send({ name: "Dr. Ghost", departmentId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("DEPARTMENT_NOT_FOUND");
  });

  it("rejects doctor name of 1 character", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .post("/api/admin/doctors")
      .set("Cookie", cookie)
      .send({ name: "X", departmentId: generalMedicine.id });
    expect(res.status).toBe(422);
  });

  it("rejects non-UUID departmentId", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .post("/api/admin/doctors")
      .set("Cookie", cookie)
      .send({ name: "Dr. Test", departmentId: "not-a-uuid" });
    expect(res.status).toBe(422);
  });

  it("rejects missing name", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .post("/api/admin/doctors")
      .set("Cookie", cookie)
      .send({ departmentId: generalMedicine.id });
    expect(res.status).toBe(422);
  });
});

// PATCH /api/admin/doctors/:id --------------------------------------------

describe("PATCH /api/admin/doctors/:id", () => {
  it("[AC10] renames a doctor", async () => {
    const cookie = await loginAsAdmin();
    const doctor = await createDoctor("Dr. Old Name", generalMedicine.id);
    const res = await request(app)
      .patch("/api/admin/doctors/" + doctor.id)
      .set("Cookie", cookie)
      .send({ name: "Dr. New Name" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Dr. New Name");
  });

  it("[AC10] reassigns a doctor to a different department", async () => {
    const cookie = await loginAsAdmin();
    const cardiology = await createDept("Cardiology", true);
    const doctor = await createDoctor("Dr. Priya Sharma", generalMedicine.id);
    const res = await request(app)
      .patch("/api/admin/doctors/" + doctor.id)
      .set("Cookie", cookie)
      .send({ departmentId: cardiology.id });
    expect(res.status).toBe(200);
    expect(res.body.department.name).toBe("Cardiology");
    expect(res.body.departmentId).toBe(cardiology.id);
  });

  it("[AC9] returns 404 when reassigning to non-existent department", async () => {
    const cookie = await loginAsAdmin();
    const doctor = await createDoctor("Dr. Priya Sharma", generalMedicine.id);
    const res = await request(app)
      .patch("/api/admin/doctors/" + doctor.id)
      .set("Cookie", cookie)
      .send({ departmentId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("DEPARTMENT_NOT_FOUND");
  });

  it("returns 404 DOCTOR_NOT_FOUND for non-existent doctor id", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .patch("/api/admin/doctors/00000000-0000-0000-0000-000000000000")
      .set("Cookie", cookie)
      .send({ name: "Dr. Ghost" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("DOCTOR_NOT_FOUND");
  });
});

// PATCH /api/admin/doctors/:id/status ------------------------------------

describe("PATCH /api/admin/doctors/:id/status", () => {
  it("[AC11] deactivates an active doctor", async () => {
    const cookie = await loginAsAdmin();
    const doctor = await createDoctor("Dr. Priya Sharma", generalMedicine.id, true);
    const res = await request(app)
      .patch("/api/admin/doctors/" + doctor.id + "/status")
      .set("Cookie", cookie)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it("[AC12] activates an inactive doctor when department is active", async () => {
    const cookie = await loginAsAdmin();
    const doctor = await createDoctor("Dr. Rajesh Patel", generalMedicine.id, false);
    const res = await request(app)
      .patch("/api/admin/doctors/" + doctor.id + "/status")
      .set("Cookie", cookie)
      .send({ isActive: true });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
  });

  it("[AC13] returns 409 DEPARTMENT_INACTIVE when activating doctor in inactive dept", async () => {
    const cookie = await loginAsAdmin();
    // boneHealth is inactive (created in beforeEach with isActive=false)
    const doctor = await createDoctor("Dr. Arun Mehta", boneHealth.id, false);
    const res = await request(app)
      .patch("/api/admin/doctors/" + doctor.id + "/status")
      .set("Cookie", cookie)
      .send({ isActive: true });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DEPARTMENT_INACTIVE");
  });

  it("returns 404 for non-existent doctor", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .patch("/api/admin/doctors/00000000-0000-0000-0000-000000000000/status")
      .set("Cookie", cookie)
      .send({ isActive: true });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("DOCTOR_NOT_FOUND");
  });

  it("returns 422 when isActive is missing", async () => {
    const cookie = await loginAsAdmin();
    const doctor = await createDoctor("Dr. Priya Sharma", generalMedicine.id, true);
    const res = await request(app)
      .patch("/api/admin/doctors/" + doctor.id + "/status")
      .set("Cookie", cookie)
      .send({});
    expect(res.status).toBe(422);
  });
});

// GET /api/doctors (receptionist active-only) ----------------------------

describe("GET /api/doctors (receptionist active-only)", () => {
  it("[AC14] excludes inactive doctors", async () => {
    const cookie = await loginAsReceptionist();
    await createDoctor("Dr. Priya Sharma", generalMedicine.id, true);
    await createDoctor("Dr. Rajesh Patel", generalMedicine.id, false);
    const res = await request(app).get("/api/doctors").set("Cookie", cookie);
    expect(res.status).toBe(200);
    const names = res.body.map((d) => d.name);
    expect(names).toContain("Dr. Priya Sharma");
    expect(names).not.toContain("Dr. Rajesh Patel");
  });

  it("[AC15] excludes active doctors in inactive departments", async () => {
    const cookie = await loginAsReceptionist();
    // boneHealth is inactive; doctor in it is active
    await createDoctor("Dr. Arun Mehta", boneHealth.id, true);
    const res = await request(app).get("/api/doctors").set("Cookie", cookie);
    expect(res.status).toBe(200);
    const names = res.body.map((d) => d.name);
    expect(names).not.toContain("Dr. Arun Mehta");
  });
});
