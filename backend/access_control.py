from typing import Any, Dict, Iterable, Optional

from fastapi import HTTPException


GLOBAL_READONLY_ROLES = frozenset({"penerus_ilmu", "ketua_yayasan"})
OFFICIAL_ROLES = frozenset(
    {"super_admin", "admin_cabang", "viewer"} | GLOBAL_READONLY_ROLES
)
BRANCH_SCOPED_ROLES = frozenset({"admin_cabang", "viewer"})
WRITE_ROLES = frozenset({"super_admin", "admin_cabang"})


def require_official_role(user: Dict[str, Any]) -> str:
    """Return the user's role, denying missing or unsupported roles."""
    role = user.get("role")
    if role not in OFFICIAL_ROLES:
        raise HTTPException(status_code=403, detail="Role tidak diizinkan.")
    return role


def require_roles(user: Dict[str, Any], allowed_roles: Iterable[str]) -> None:
    """Require one of the explicitly allowed official roles."""
    role = require_official_role(user)
    if role not in frozenset(allowed_roles):
        raise HTTPException(status_code=403, detail="Anda tidak memiliki izin.")


def is_super_admin(user: Dict[str, Any]) -> bool:
    return require_official_role(user) == "super_admin"


def is_global_readonly(user: Dict[str, Any]) -> bool:
    return require_official_role(user) in GLOBAL_READONLY_ROLES


def is_branch_scoped(user: Dict[str, Any]) -> bool:
    return require_official_role(user) in BRANCH_SCOPED_ROLES


def can_write(user: Dict[str, Any]) -> bool:
    return require_official_role(user) in WRITE_ROLES


def require_super_admin(user: Dict[str, Any]) -> None:
    require_roles(user, {"super_admin"})


def require_write_access(user: Dict[str, Any]) -> None:
    if not can_write(user):
        raise HTTPException(status_code=403, detail="Anda tidak memiliki izin.")


def require_branch_assignment(user: Dict[str, Any]) -> None:
    """Ensure branch-scoped roles are assigned to a branch before data access."""
    role = require_official_role(user)
    if role in BRANCH_SCOPED_ROLES and not user.get("cabang_id"):
        raise HTTPException(
            status_code=403,
            detail="Akun belum memiliki assignment cabang.",
        )


def get_data_scope(user: Dict[str, Any]) -> Optional[Dict[str, str]]:
    """Return the MongoDB branch filter for a user, or None for super admins."""
    role = require_official_role(user)
    if role == "super_admin" or role in GLOBAL_READONLY_ROLES:
        return None

    if role in BRANCH_SCOPED_ROLES:
        require_branch_assignment(user)
        return {"cabang_id": user["cabang_id"]}

    raise HTTPException(status_code=403, detail="Role tidak memiliki scope data yang valid.")


def scoped_query(
    scope: Optional[Dict[str, Any]], query: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Combine mandatory scope and caller filters without allowing key overrides."""
    filters = dict(query or {})
    if scope is None:
        return filters
    if not filters:
        return dict(scope)
    return {"$and": [dict(scope), filters]}
