import { canViewResource } from "../../lib/permissions";
import { NAV, filterVisibleNavigation } from "./navigation";

const OPERATIONAL_PATHS = [
  "/admin/dashboard",
  "/admin/cabang",
  "/admin/guru",
  "/admin/jamaah",
  "/admin/pengurus",
  "/admin/agenda",
  "/admin/galeri",
  "/admin/laporan",
  "/admin/profil",
];

const SENSITIVE_PATHS = [
  "/admin/users",
  "/admin/pesan",
  "/admin/audit",
  "/admin/pengaturan",
];

const visiblePaths = (role) =>
  filterVisibleNavigation(NAV, (resource) => canViewResource(role, resource))
    .flatMap((group) => group.items)
    .map((item) => item.to);

describe("AdminLayout navigation visibility", () => {
  test("super_admin sees operational and sensitive menus", () => {
    expect(visiblePaths("super_admin")).toEqual([
      ...OPERATIONAL_PATHS.slice(0, 5),
      "/admin/users",
      ...OPERATIONAL_PATHS.slice(5, 7),
      "/admin/pesan",
      OPERATIONAL_PATHS[7],
      "/admin/audit",
      "/admin/pengaturan",
      OPERATIONAL_PATHS[8],
    ]);
  });

  test.each([
    "admin_cabang",
    "viewer",
    "viewer_1",
    "viewer_2",
    "penerus_ilmu",
    "ketua_yayasan",
  ])("%s sees operational menus and no sensitive menus", (role) => {
    const paths = visiblePaths(role);
    expect(paths).toEqual(OPERATIONAL_PATHS);
    SENSITIVE_PATHS.forEach((path) => expect(paths).not.toContain(path));
  });

  test.each(["unknown", "", null, undefined])(
    "unknown or missing role %p sees no navigation groups",
    (role) => {
      expect(visiblePaths(role)).toEqual([]);
      expect(
        filterVisibleNavigation(NAV, (resource) => canViewResource(role, resource)),
      ).toEqual([]);
    },
  );

  test("every menu has one explicit permission resource", () => {
    NAV.flatMap((group) => group.items).forEach((item) => {
      expect(item.resource).toEqual(expect.any(String));
      expect(item.resource).not.toBe("");
    });
  });
});
