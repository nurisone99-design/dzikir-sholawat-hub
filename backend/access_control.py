from typing import Any, Dict, Optional

from fastapi import HTTPException


BRANCH_SCOPED_ROLES = frozenset({"admin_cabang", "viewer"})


def require_branch_assignment(user: Dict[str, Any]) -> None:
    """Ensure branch-scoped roles are assigned to a branch before data access."""
    if user.get("role") in BRANCH_SCOPED_ROLES and not user.get("cabang_id"):
        raise HTTPException(
            status_code=403,
            detail="Akun belum memiliki assignment cabang.",
        )


def get_data_scope(user: Dict[str, Any]) -> Optional[Dict[str, str]]:
    """Return the MongoDB branch filter for a user, or None for super admins."""
    if user.get("role") == "super_admin":
        return None

    if user.get("role") in BRANCH_SCOPED_ROLES:
        require_branch_assignment(user)
        return {"cabang_id": user["cabang_id"]}

    raise HTTPException(status_code=403, detail="Role tidak memiliki scope data yang valid.")
