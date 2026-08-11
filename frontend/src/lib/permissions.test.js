import {
  READ_SCOPE,
  WRITE_SCOPE,
  canReadGlobally,
  canViewResource,
  canWrite,
  canWriteResource,
  getReadScope,
  getWriteScope,
} from "./permissions";

const INTERNAL = ["jamaah", "guru", "pengurus"];
const GLOBAL_READONLY = ["penerus_ilmu", "ketua_yayasan"];
const GLOBAL_READ_BRANCH_WRITE = ["agenda", "galeri", "pengumuman"];

describe("frontend authorization policy", () => {
  test("super_admin has global read and write", () => {
    [...INTERNAL, ...GLOBAL_READ_BRANCH_WRITE].forEach((resource) => {
      expect(getReadScope("super_admin", resource)).toBe(READ_SCOPE.GLOBAL);
      expect(getWriteScope("super_admin", resource)).toBe(WRITE_SCOPE.GLOBAL);
    });
    expect(canWrite("super_admin")).toBe(true);
  });

  test("admin_cabang has branch internal access and special Agenda/Galeri scope", () => {
    INTERNAL.forEach((resource) => {
      expect(getReadScope("admin_cabang", resource)).toBe(READ_SCOPE.BRANCH);
      expect(getWriteScope("admin_cabang", resource)).toBe(WRITE_SCOPE.BRANCH);
    });
    GLOBAL_READ_BRANCH_WRITE.forEach((resource) => {
      expect(getReadScope("admin_cabang", resource)).toBe(READ_SCOPE.GLOBAL);
      expect(getWriteScope("admin_cabang", resource)).toBe(WRITE_SCOPE.BRANCH);
    });
    expect(getReadScope("admin_cabang", "cabang")).toBe(READ_SCOPE.BRANCH);
    expect(getWriteScope("admin_cabang", "cabang")).toBe(WRITE_SCOPE.NONE);
  });

  test("super_admin has global read and write for cabang", () => {
    expect(getReadScope("super_admin", "cabang")).toBe(READ_SCOPE.GLOBAL);
    expect(getWriteScope("super_admin", "cabang")).toBe(WRITE_SCOPE.GLOBAL);
    expect(canWriteResource("super_admin", "cabang")).toBe(true);
    expect(canWrite("super_admin")).toBe(true);
  });

  test("viewer has branch internal read, global Agenda/Galeri read, and no write", () => {
    INTERNAL.forEach((resource) => {
      expect(getReadScope("viewer", resource)).toBe(READ_SCOPE.BRANCH);
      expect(canWriteResource("viewer", resource)).toBe(false);
    });
    GLOBAL_READ_BRANCH_WRITE.forEach((resource) => {
      expect(canReadGlobally("viewer", resource)).toBe(true);
      expect(canWriteResource("viewer", resource)).toBe(false);
    });
  });

  test.each(GLOBAL_READONLY)("%s has global operational read and no write", (role) => {
    [...INTERNAL, ...GLOBAL_READ_BRANCH_WRITE].forEach((resource) => {
      expect(getReadScope(role, resource)).toBe(READ_SCOPE.GLOBAL);
      expect(canWriteResource(role, resource)).toBe(false);
    });
    expect(canWrite(role)).toBe(false);
  });

  test("sensitive resources are visible only to super_admin", () => {
    ["users", "settings", "audit_logs", "messages"].forEach((resource) => {
      expect(canViewResource("super_admin", resource)).toBe(true);
      ["admin_cabang", "viewer", ...GLOBAL_READONLY].forEach((role) => {
        expect(canViewResource(role, resource)).toBe(false);
      });
    });
  });

  test.each(["random_role", "", null, undefined])(
    "unknown or missing role %p is denied by default",
    (role) => {
      expect(canViewResource(role, "jamaah")).toBe(false);
      expect(canReadGlobally(role, "agenda")).toBe(false);
      expect(getReadScope(role, "jamaah")).toBe(READ_SCOPE.NONE);
      expect(getWriteScope(role, "jamaah")).toBe(WRITE_SCOPE.NONE);
      expect(canWrite(role)).toBe(false);
    },
  );
});
