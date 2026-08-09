import { getReadScope, getWriteScope } from "../../lib/permissions";
import {
  canWriteCrudRow,
  getInitialBranchValue,
  getScopedBranchOptions,
} from "./crudBranchScope";

const resources = ["jamaah", "guru", "pengurus"];
const options = [
  { value: "CABANG_A", label: "Cabang A" },
  { value: "CABANG_B", label: "Cabang B" },
];

describe("Jamaah, Guru, and Pengurus branch action guards", () => {
  test.each(resources)("%s follows the final write policy", (resource) => {
    expect(getWriteScope("super_admin", resource)).toBe("global");
    expect(getWriteScope("admin_cabang", resource)).toBe("branch");
    expect(getWriteScope("viewer", resource)).toBe("none");
    expect(getWriteScope("penerus_ilmu", resource)).toBe("none");
    expect(getWriteScope("ketua_yayasan", resource)).toBe("none");
    expect(getWriteScope("unknown", resource)).toBe("none");
    expect(getWriteScope(null, resource)).toBe("none");
  });

  test.each(resources)("%s follows the final read scope", (resource) => {
    expect(getReadScope("super_admin", resource)).toBe("global");
    expect(getReadScope("admin_cabang", resource)).toBe("branch");
    expect(getReadScope("viewer", resource)).toBe("branch");
    expect(getReadScope("penerus_ilmu", resource)).toBe("global");
    expect(getReadScope("ketua_yayasan", resource)).toBe("global");
    expect(getReadScope("unknown", resource)).toBe("none");
    expect(getReadScope(undefined, resource)).toBe("none");
  });

  test.each([
    ["jamaah", "id_cabang", "CABANG_A"],
    ["guru", "cabang_ids", ["CABANG_A"]],
    ["pengurus", "cabang_id", "CABANG_A"],
  ])("admin create assigns its branch for %s", (resource, fieldKey, expected) => {
    expect(
      getInitialBranchValue({
        resource,
        fieldKey,
        writeScope: "branch",
        assignedBranchId: "CABANG_A",
      }),
    ).toEqual(expected);
  });

  test.each([
    ["jamaah", "id_cabang"],
    ["guru", "cabang_ids"],
    ["pengurus", "cabang_id"],
  ])("admin only receives its branch option for %s", (resource, fieldKey) => {
    expect(
      getScopedBranchOptions({
        resource,
        fieldKey,
        options,
        writeScope: "branch",
        assignedBranchId: "CABANG_A",
      }),
    ).toEqual([options[0]]);
  });

  test("super admin retains all branch options", () => {
    expect(
      getScopedBranchOptions({
        resource: "jamaah",
        fieldKey: "id_cabang",
        options,
        writeScope: "global",
        assignedBranchId: "CABANG_A",
      }),
    ).toEqual(options);
  });

  test.each([
    ["jamaah", { id_cabang: "CABANG_A" }, true],
    ["jamaah", { id_cabang: "CABANG_B" }, false],
    ["guru", { cabang_ids: ["CABANG_A"] }, true],
    ["guru", { cabang_ids: ["CABANG_B"] }, false],
    ["pengurus", { cabang_id: "CABANG_A" }, true],
    ["pengurus", { cabang_id: "CABANG_B" }, false],
  ])("branch ownership is enforced for %s", (resource, row, expected) => {
    expect(
      canWriteCrudRow({
        resource,
        row,
        writeScope: "branch",
        assignedBranchId: "CABANG_A",
      }),
    ).toBe(expected);
  });

  test("missing branch assignment and read-only scope deny row mutation", () => {
    expect(
      canWriteCrudRow({
        resource: "jamaah",
        row: { id_cabang: "CABANG_A" },
        writeScope: "branch",
        assignedBranchId: null,
      }),
    ).toBe(false);
    expect(
      canWriteCrudRow({
        resource: "jamaah",
        row: { id_cabang: "CABANG_A" },
        writeScope: "none",
        assignedBranchId: "CABANG_A",
      }),
    ).toBe(false);
  });
});
