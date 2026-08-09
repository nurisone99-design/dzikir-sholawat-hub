export function resolveCrudResource(endpoint) {
  if (typeof endpoint !== "string") return "";
  return endpoint.trim().replace(/^\/+|\/+$/g, "").split("/")[0] || "";
}

export async function executeAuthorizedMutation({
  allowed,
  mutation,
  onDenied,
}) {
  if (!allowed) {
    onDenied?.();
    return { executed: false, value: undefined };
  }

  return { executed: true, value: await mutation() };
}
