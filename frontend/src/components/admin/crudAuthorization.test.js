import { canWriteResource } from "../../lib/permissions";
import {
  executeAuthorizedMutation,
  resolveCrudResource,
} from "./crudAuthorization";

describe("shared CRUD authorization", () => {
  test.each([
    ["super_admin", "jamaah", true],
    ["admin_cabang", "jamaah", true],
    ["admin_cabang", "guru", true],
    ["admin_cabang", "pengurus", true],
    ["admin_cabang", "cabang", false],
    ["viewer", "jamaah", false],
    ["penerus_ilmu", "jamaah", false],
    ["ketua_yayasan", "jamaah", false],
    ["unknown_role", "jamaah", false],
    [null, "jamaah", false],
    [undefined, "jamaah", false],
    ["super_admin", "unknown-resource", false],
  ])("role %p write access for %s is %p", (role, endpoint, expected) => {
    const resource = resolveCrudResource(endpoint);
    expect(canWriteResource(role, resource)).toBe(expected);
  });

  test("resource resolution uses the existing endpoint and defaults invalid input to deny", () => {
    expect(resolveCrudResource("/jamaah/")).toBe("jamaah");
    expect(resolveCrudResource("guru")).toBe("guru");
    expect(resolveCrudResource("")).toBe("");
    expect(resolveCrudResource(null)).toBe("");
  });

  test("denied mutation does not execute the request and reports denial", async () => {
    const mutation = jest.fn();
    const onDenied = jest.fn();

    const result = await executeAuthorizedMutation({
      allowed: false,
      mutation,
      onDenied,
    });

    expect(result).toEqual({ executed: false, value: undefined });
    expect(mutation).not.toHaveBeenCalled();
    expect(onDenied).toHaveBeenCalledTimes(1);
  });

  test("allowed mutation executes the request exactly once", async () => {
    const mutation = jest.fn().mockResolvedValue({ id: "saved" });
    const onDenied = jest.fn();

    const result = await executeAuthorizedMutation({
      allowed: true,
      mutation,
      onDenied,
    });

    expect(result).toEqual({ executed: true, value: { id: "saved" } });
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(onDenied).not.toHaveBeenCalled();
  });
});
