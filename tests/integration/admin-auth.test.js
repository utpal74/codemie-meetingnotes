/**
 * Integration tests: Admin auth and role guard middleware
 * Story: EPMCDMETST-68125  AC covered: AC1
 *
 * Prerequisites: ADMIN_USERNAME, ADMIN_PASSWORD, RECEPTIONIST_USERNAME, RECEPTIONIST_PASSWORD env vars
 * Run: npx jest tests/integration/admin-auth.test.js
 */
const request = require("supertest");
const app = require("../../backend/src/app");

// helpers ----------------------------------------------------------------

async function loginAs(role) {
  const creds =
    role === "ADMIN"
      ? { username: process.env.ADMIN_USERNAME || "admin",
          password: process.env.ADMIN_PASSWORD || "adminpassword" }
      : { username: process.env.RECEPTIONIST_USERNAME || "receptionist",
          password: process.env.RECEPTIONIST_PASSWORD || "receptionistpassword" };
  const res = await request(app).post("/api/auth/login").send(creds);
  if (res.status !== 200)
    throw new Error("Login failed for " + role + ": " + JSON.stringify(res.body));
  return res.headers["set-cookie"];
}

// tests ------------------------------------------------------------------

describe("Role Guard /api/admin/* endpoints (AC1)", () => {
  const adminEndpoints = [
    { method: "get",  url: "/api/admin/departments" },
    { method: "get",  url: "/api/admin/doctors" },
    { method: "post", url: "/api/admin/departments" },
    { method: "post", url: "/api/admin/doctors" },
  ];

  // Unauthenticated -> 401
  adminEndpoints.forEach(({ method, url }) => {
    it("[AC1] " + method.toUpperCase() + " " + url + " returns 401 when unauthenticated", async () => {
      const res = await request(app)[method](url).send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  // RECEPTIONIST -> 403
  describe("authenticated as RECEPTIONIST", () => {
    let cookie;
    beforeAll(async () => { cookie = await loginAs("RECEPTIONIST"); });

    adminEndpoints.forEach(({ method, url }) => {
      it("[AC1] " + method.toUpperCase() + " " + url + " returns 403 for RECEPTIONIST", async () => {
        const res = await request(app)[method](url).set("Cookie", cookie).send({});
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("FORBIDDEN");
      });
    });
  });

  // ADMIN -> 200
  describe("authenticated as ADMIN", () => {
    let cookie;
    beforeAll(async () => { cookie = await loginAs("ADMIN"); });

    it("[AC1] GET /api/admin/departments returns 200 for ADMIN", async () => {
      const res = await request(app).get("/api/admin/departments").set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("[AC1] GET /api/admin/doctors returns 200 for ADMIN", async () => {
      const res = await request(app).get("/api/admin/doctors").set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});

describe("/api/auth/me role info", () => {
  it("returns authenticated=false and role=null when not logged in", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(false);
    expect(res.body.role).toBeNull();
  });

  it("returns role=RECEPTIONIST for receptionist session", async () => {
    const cookie = await loginAs("RECEPTIONIST");
    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.role).toBe("RECEPTIONIST");
  });

  it("returns role=ADMIN for admin session", async () => {
    const cookie = await loginAs("ADMIN");
    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.role).toBe("ADMIN");
  });
});
