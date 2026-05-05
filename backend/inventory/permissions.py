"""
Role-based permissions for Inventra.

Roles are mapped to Django Groups:
  - MANAGER: full access (default for superusers).
  - SUPERVISOR: stock management, transactions, stock-take operations.
  - STAFF: limited write access (purchases, breakage, transfers).

The helper `get_user_role(user)` is reused across the codebase and the /me
endpoint to expose a stable role token to the frontend.
"""
from rest_framework import permissions

ROLE_MANAGER = 'MANAGER'
ROLE_SUPERVISOR = 'SUPERVISOR'
ROLE_STAFF = 'STAFF'

VALID_ROLES = (ROLE_MANAGER, ROLE_SUPERVISOR, ROLE_STAFF)


def get_user_role(user) -> str:
    """Return the highest role the user holds.

    Resolution order:
      1. Superusers always treated as MANAGER.
      2. Otherwise, the first matching group name from MANAGER -> SUPERVISOR
         -> STAFF wins.
      3. Default fallback is STAFF for authenticated users.
    """
    if not user or not user.is_authenticated:
        return ROLE_STAFF
    if user.is_superuser:
        return ROLE_MANAGER
    group_names = set(user.groups.values_list('name', flat=True))
    for role in (ROLE_MANAGER, ROLE_SUPERVISOR, ROLE_STAFF):
        if role in group_names:
            return role
    return ROLE_STAFF


class IsManager(permissions.BasePermission):
    """Allow only users with the MANAGER role."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return get_user_role(request.user) == ROLE_MANAGER


class IsManagerOrReadOnly(permissions.BasePermission):
    """Allow read for any authenticated user, write only for managers."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return get_user_role(request.user) == ROLE_MANAGER


class IsSupervisorOrManager(permissions.BasePermission):
    """Allow only Supervisor and Manager roles to write; everyone authenticated reads."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return get_user_role(request.user) in (ROLE_SUPERVISOR, ROLE_MANAGER)


class TransactionPermission(permissions.BasePermission):
    """
    Transactions:
      - GET / list: any authenticated user.
      - WRITE_OFF: MANAGER only.
      - ADJUSTMENT: MANAGER only.
      - PURCHASE / BREAKAGE / TRANSFER: any authenticated role.
    Mutating writes additionally must not target a locked (closed) month —
    that's enforced inside the viewset.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        role = get_user_role(request.user)
        
        tx_types = set()
        if hasattr(request, 'data'):
            if isinstance(request.data, list):
                tx_types = {item.get('type') for item in request.data if isinstance(item, dict)}
            elif isinstance(request.data, dict):
                tx_types = {request.data.get('type')}
                
        if any(tx_type in ('WRITE_OFF', 'ADJUSTMENT') for tx_type in tx_types):
            return role == ROLE_MANAGER
        return role in VALID_ROLES
