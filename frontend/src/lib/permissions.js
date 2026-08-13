export const ROLES = Object.freeze({
  SUPER_ADMIN: "super_admin",
  ADMIN_CABANG: "admin_cabang",
  VIEWER: "viewer",
  PENERUS_ILMU: "penerus_ilmu",
  KETUA_YAYASAN: "ketua_yayasan",
  VIEWER_1: "viewer_1",
  VIEWER_2: "viewer_2",
});

export const ROLE_LABELS = Object.freeze({
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.ADMIN_CABANG]: "Admin Cabang",
  [ROLES.VIEWER]: "Viewer",
  [ROLES.PENERUS_ILMU]: "Penerus Ilmu",
  [ROLES.KETUA_YAYASAN]: "Ketua Yayasan",
  [ROLES.VIEWER_1]: "Viewer 1",
  [ROLES.VIEWER_2]: "Viewer 2",
});

export const READ_SCOPE = Object.freeze({ GLOBAL: "global", BRANCH: "branch", NONE: "none" });
export const WRITE_SCOPE = Object.freeze({ GLOBAL: "global", BRANCH: "branch", NONE: "none" });

const OFFICIAL_ROLES = new Set(Object.values(ROLES));
const GLOBAL_READONLY_ROLES = new Set([ROLES.PENERUS_ILMU, ROLES.KETUA_YAYASAN, ROLES.VIEWER_1]);
const BRANCH_SCOPED_ROLES = new Set([ROLES.ADMIN_CABANG, ROLES.VIEWER, ROLES.VIEWER_2]);
const GLOBAL_GURU_ROLES = new Set([ROLES.VIEWER_2]);
const GLOBAL_READ_RESOURCES = new Set(["agenda", "galeri", "pengumuman"]);
const BRANCH_READ_RESOURCES = new Set([
  "jamaah", "guru", "pengurus", "cabang", "dashboard",
]);
const BRANCH_WRITE_RESOURCES = new Set([
  "jamaah", "guru", "pengurus", "agenda", "galeri", "pengumuman",
]);
const OPERATIONAL_RESOURCES = new Set([
  ...GLOBAL_READ_RESOURCES, ...BRANCH_READ_RESOURCES, "export", "profile",
]);
const SENSITIVE_RESOURCES = new Set(["users", "settings", "audit_logs", "messages"]);

export const isOfficialRole = (role) => OFFICIAL_ROLES.has(role);
export const isSuperAdmin = (role) => role === ROLES.SUPER_ADMIN;
export const isAdminCabang = (role) => role === ROLES.ADMIN_CABANG;
export const isViewerRole = (role) => role === ROLES.VIEWER;
export const isPenerusIlmu = (role) => role === ROLES.PENERUS_ILMU;
export const isKetuaYayasan = (role) => role === ROLES.KETUA_YAYASAN;
export const isGlobalReadonly = (role) => GLOBAL_READONLY_ROLES.has(role);
export const isBranchScoped = (role) => BRANCH_SCOPED_ROLES.has(role);
export const isGlobalGuruRole = (role) => GLOBAL_GURU_ROLES.has(role);
export const isReadOnlyRole = (role) =>
  isViewerRole(role) || isGlobalReadonly(role) || isGlobalGuruRole(role);

export function canViewResource(role, resource) {
  if (!isOfficialRole(role)) return false;
  if (SENSITIVE_RESOURCES.has(resource)) return isSuperAdmin(role);
  return OPERATIONAL_RESOURCES.has(resource);
}

export function getReadScope(role, resource) {
  if (!canViewResource(role, resource)) return READ_SCOPE.NONE;
  if (isSuperAdmin(role) || isGlobalReadonly(role)) return READ_SCOPE.GLOBAL;
  if (isGlobalGuruRole(role) && resource === "guru") return READ_SCOPE.GLOBAL;
  if (GLOBAL_READ_RESOURCES.has(resource)) return READ_SCOPE.GLOBAL;
  if (isBranchScoped(role) && BRANCH_READ_RESOURCES.has(resource)) return READ_SCOPE.BRANCH;
  if (resource === "export" || resource === "profile") {
    return isBranchScoped(role) ? READ_SCOPE.BRANCH : READ_SCOPE.GLOBAL;
  }
  return READ_SCOPE.NONE;
}

export const canReadGlobally = (role, resource) =>
  getReadScope(role, resource) === READ_SCOPE.GLOBAL;

export function getWriteScope(role, resource) {
  if (!isOfficialRole(role)) return WRITE_SCOPE.NONE;
  if (isSuperAdmin(role)) {
    return canViewResource(role, resource) ? WRITE_SCOPE.GLOBAL : WRITE_SCOPE.NONE;
  }
  if (isAdminCabang(role) && BRANCH_WRITE_RESOURCES.has(resource)) return WRITE_SCOPE.BRANCH;
  return WRITE_SCOPE.NONE;
}

export const canWriteResource = (role, resource) =>
  getWriteScope(role, resource) !== WRITE_SCOPE.NONE;

// Harus sama dengan VIEWER_2_EXPORT_ENTITIES di backend (server.py): Viewer 2
// hanya boleh mengekspor data yang berada dalam scope cabangnya (Jamaah, Cabang,
// Pengurus). Guru dapat dibaca global tapi tidak untuk export; agenda/galeri/
// pengumuman juga di luar scope export Viewer 2.
const VIEWER_2_EXPORT_ENTITIES = new Set(["jamaah", "cabang", "pengurus"]);

export const canExportEntity = (role, entity) => {
  if (!isOfficialRole(role) || !OPERATIONAL_RESOURCES.has(entity)) return false;
  if (isGlobalGuruRole(role)) return VIEWER_2_EXPORT_ENTITIES.has(entity);
  return true;
};

export function canWrite(role, resource) {
  if (resource) return canWriteResource(role, resource);
  return isSuperAdmin(role) || isAdminCabang(role);
}
