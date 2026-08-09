import { WRITE_SCOPE } from "../../lib/permissions";

const SCOPED_CRUD_RESOURCES = new Set(["jamaah", "guru", "pengurus"]);
const BRANCH_FIELD_KEYS = new Set(["cabang_id", "id_cabang", "cabang_ids"]);

const normalizeId = (value) =>
  value === undefined || value === null ? "" : String(value);

export const usesCrudBranchScope = (resource) =>
  SCOPED_CRUD_RESOURCES.has(resource);

export const isBranchField = (key) => BRANCH_FIELD_KEYS.has(key);

export function getScopedBranchOptions({
  resource,
  fieldKey,
  options,
  writeScope,
  assignedBranchId,
}) {
  if (
    !usesCrudBranchScope(resource) ||
    !isBranchField(fieldKey) ||
    writeScope !== WRITE_SCOPE.BRANCH
  ) {
    return options;
  }

  const branchId = normalizeId(assignedBranchId);
  if (!branchId) return [];

  return options.filter((option) =>
    normalizeId(typeof option === "string" ? option : option.value) === branchId,
  );
}

export function getInitialBranchValue({
  resource,
  fieldKey,
  writeScope,
  assignedBranchId,
}) {
  if (
    !usesCrudBranchScope(resource) ||
    !isBranchField(fieldKey) ||
    writeScope !== WRITE_SCOPE.BRANCH
  ) {
    return undefined;
  }

  const branchId = normalizeId(assignedBranchId);
  if (!branchId) return fieldKey === "cabang_ids" ? [] : "";
  return fieldKey === "cabang_ids" ? [branchId] : branchId;
}

export function canWriteCrudRow({
  resource,
  row,
  writeScope,
  assignedBranchId,
}) {
  if (!usesCrudBranchScope(resource)) return writeScope !== WRITE_SCOPE.NONE;
  if (writeScope === WRITE_SCOPE.GLOBAL) return true;
  if (writeScope !== WRITE_SCOPE.BRANCH || !row) return false;

  const branchId = normalizeId(assignedBranchId);
  if (!branchId) return false;

  const rowBranchIds = [row.cabang_id, row.id_cabang, ...(row.cabang_ids || [])]
    .map(normalizeId)
    .filter(Boolean);

  return rowBranchIds.includes(branchId);
}
