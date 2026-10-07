/**
 * Integration tests: Admin Departments API
 * Story: EPMCDMETST-68125  AC covered: AC1-AC7, AC19, AC21
 * Run: npx jest tests/integration/admin-departments.test.js
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

const TEST_NAMES = ["Neurology","Cardiology","Bone Health","Old Name Dept","New Name Dept","ED"];

beforeEach(async () => {
  await prisma.department.deleteMany({ where: { name: { in: TEST_NAMES } } });
});
afterAll(async () => { await prisma.$disconnect(); });

// GET /api/admin/departments -----------------------------------------------

describe("GET /api/admin/departments", () => {
  it("[AC1] returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/admin/departments");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("[AC1] returns 403 for RECEPTIONIST role", async () => {
    const cookie = await loginAsReceptionist();
    const res = await request(app).get("/api/admin/departments").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("[AC7] returns active and inactive departments for ADMIN", async () => {
    const cookie = await loginAsAdmin();
    await createDept("Cardiology", true);
    await createDept("Bone Health", false);
    const res = await request(app).get("/api/admin/departments").set("Cookie", cookie);
    expect(res.status).toBe(200);
    const names = res.body.map((d) => d.name);
    expect(names).toContain("Cardiology");
    expect(names).toContain("Bone Health");
  });
});

// POST /api/admin/departments ----------------------------------------------

describe("POST /api/admin/departments", () => {
  it("[AC2] creates a department with a valid unique name", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .post("/api/admin/departments")
      .set("Cookie", cookie)
      .send({ name: "Neurology" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Neurology");
    expect(res.body.isActive).toBe(true);
    expect(res.body.id).toBeDefined();
  });

  it("[AC3] returns 409 DEPARTMENT_NAME_TAKEN for exact duplicate", async () => {
    const cookie = await loginAsAdmin();
    await createDept("Cardiology");
    const res = await request(app)
      .post("/api/admin/departments")
      .set("Cookie", cookie)
      .send({ name: "Cardiology" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DEPARTMENT_NAME_TAKEN");
    expect(res.body.error.field).toBe("name");
  });

  it("[AC3] returns 409 for lowercase duplicate (cardiology)", async () => {
    const cookie = await loginAsAdmin();
    await createDept("Cardiology");
    const res = await request(app)
      .post("/api/admin/departments")
      .set("Cookie", cookie)
      .send({ name: "cardiology" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DEPARTMENT_NAME_TAKEN");
  });

  it("[AC3] returns 409 for UPPERCASE duplicate (CARDIOLOGY)", async () => {
    const cookie = await loginAsAdmin();
    await createDept("Cardiology");
    const res = await request(app)
      .post("/api/admin/departments")
      .set("Cookie", cookie)
      .send({ name: "CARDIOLOGY" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DEPARTMENT_NAME_TAKEN");
  });

  it("[AC21] rejects name of 1 character", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .post("/api/admin/departments")
      .set("Cookie", cookie)
      .send({ name: "X" });
    expect(res.status).toBe(422);
  });

  it("[AC21] rejects name of 101 characters", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .post("/api/admin/departments")
      .set("Cookie", cookie)
      .send({ name: "A".repeat(101) });
    expect(res.status).toBe(422);
  });

  it("[AC21] accepts name of exactly 2 characters (ED)", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .post("/api/admin/departments")
      .set("Cookie", cookie)
      .send({ name: "ED" });
    expect(res.status).toBe(201);
  });

  it("[AC21] accepts name of exactly 100 characters", async () => {
    const cookie = await loginAsAdmin();
    const name100 = "A".repeat(100);
    const res = await request(app)
      .post("/api/admin/departments")
      .set("Cookie", cookie)
      .send({ name: name100 });
    expect(res.status).toBe(201);
    await prisma.department.deleteMany({ where: { name: name100 } });
  });

  it("returns 422 for missing name field", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .post("/api/admin/departments")
      .set("Cookie", cookie)
      .send({});
    expect(res.status).toBe(422);
  });
});

// PATCH /api/admin/departments/:id ----------------------------------------

describe("PATCH /api/admin/departments/:id", () => {
  it("[AC4] renames a department successfully", async () => {
    const cookie = await loginAsAdmin();
    const dept = await createDept("Old Name Dept");
    const res = await request(app)
      .patch("/api/admin/departments/" + dept.id)
      .set("Cookie", cookie)
      .send({ name: "New Name Dept" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name Dept");
  });

  it("[AC4] returns 409 when renaming to case-insensitive duplicate of another dept", async () => {
    const cookie = await loginAsAdmin();
    await createDept("Cardiology");
    const neuro = await createDept("Neurology");
    const res = await request(app)
      .patch("/api/admin/departments/" + neuro.id)
      .set("Cookie", cookie)
      .send({ name: "cardiology" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DEPARTMENT_NAME_TAKEN");
  });

  it("[AC4] allows renaming to own current name (no conflict)", async () => {
    const cookie = await loginAsAdmin();
    const dept = await createDept("Cardiology");
    const res = await request(app)
      .patch("/api/admin/departments/" + dept.id)
      .set("Cookie", cookie)
      .send({ name: "Cardiology" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Cardiology");
  });

  it("returns 404 DEPARTMENT_NOT_FOUND for non-existent id", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .patch("/api/admin/departments/00000000-0000-0000-0000-000000000000")
      .set("Cookie", cookie)
      .send({ name: "Ghost" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("DEPARTMENT_NOT_FOUND");
  });
});

// PATCH /api/admin/departments/:id/status ---------------------------------

describe("PATCH /api/admin/departments/:id/status", () => {
  it("[AC5] deactivates an active department", async () => {
    const cookie = await loginAsAdmin();
    const dept = await createDept("Cardiology", true);
    const res = await request(app)
      .patch("/api/admin/departments/" + dept.id + "/status")
      .set("Cookie", cookie)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it("[AC6] activates an inactive department", async () => {
    const cookie = await loginAsAdmin();
    const dept = await createDept("Bone Health", false);
    const res = await request(app)
      .patch("/api/admin/departments/" + dept.id + "/status")
      .set("Cookie", cookie)
      .send({ isActive: true });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
  });

  it("returns 404 for non-existent department id", async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .patch("/api/admin/departments/00000000-0000-0000-0000-000000000000/status")
      .set("Cookie", cookie)
      .send({ isActive: false });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("DEPARTMENT_NOT_FOUND");
  });

  it("returns 422 when isActive is missing", async () => {
    const cookie = await loginAsAdmin();
    const dept = await createDept("Cardiology", true);
    const res = await request(app)
      .patch("/api/admin/departments/" + dept.id + "/status")
      .set("Cookie", cookie)
      .send({});
    expect(res.status).toBe(422);
  });
});

// GET /api/departments (receptionist) -------------------------------------

describe("GET /api/departments (receptionist active-only)", () => {
  it("[AC7] excludes inactive departments from receptionist list", async () => {
    const cookie = await loginAsReceptionist();
    await createDept("Cardiology", true);
    await createDept("Bone Health", false);
    const res = await request(app).get("/api/departments").set("Cookie", cookie);
    expect(res.status).toBe(200);
    const names = res.body.map((d) => d.name);
    expect(names).toContain("Cardiology");
    expect(names).not.toContain("Bone Health");
  });
});
