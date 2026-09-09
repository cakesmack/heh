"""Static regression tests for the removed groups debug/schema-repair routes.

These tests intentionally parse source without importing the FastAPI application,
loading settings, creating an engine, or invoking application lifespan hooks.
"""

import ast
from pathlib import Path
import unittest


GROUPS_SOURCE = Path(__file__).parents[1] / "app" / "api" / "groups.py"


def _groups_source() -> str:
    return GROUPS_SOURCE.read_text(encoding="utf-8")


def _router_declarations(source: str) -> list[tuple[str, str]]:
    tree = ast.parse(source, filename=str(GROUPS_SOURCE))
    declarations: list[tuple[str, str]] = []

    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for decorator in node.decorator_list:
            if not isinstance(decorator, ast.Call) or not decorator.args:
                continue
            function = decorator.func
            if (
                isinstance(function, ast.Attribute)
                and isinstance(function.value, ast.Name)
                and function.value.id == "router"
                and function.attr in {"get", "post", "put", "patch", "delete"}
                and isinstance(decorator.args[0], ast.Constant)
                and isinstance(decorator.args[0].value, str)
            ):
                declarations.append((function.attr.upper(), decorator.args[0].value))

    return declarations


class GroupsDebugRouteRemovalTests(unittest.TestCase):
    def test_debug_routes_are_not_registered(self) -> None:
        paths = {path for _, path in _router_declarations(_groups_source())}

        self.assertNotIn("/debug/check-roles", paths)
        self.assertNotIn("/debug/add-admin-role", paths)
        self.assertFalse(any(path.startswith("/debug/") for path in paths))

    def test_schema_repair_and_traceback_disclosure_are_absent(self) -> None:
        source = _groups_source()

        self.assertNotIn("ALTER TYPE grouprole", source)
        self.assertNotIn("enum_range(NULL::grouprole)", source)
        self.assertNotIn("traceback.format_exc", source)

    def test_normal_group_routes_remain_registered(self) -> None:
        declarations = _router_declarations(_groups_source())
        expected = {
            ("POST", "/{group_id}/invite"),
            ("GET", "/{group_id}/invites"),
            ("DELETE", "/{group_id}/invites/{token}"),
            ("POST", "/join/{token}"),
            ("GET", "/{group_id}/members"),
            ("DELETE", "/{group_id}/members/{user_id}"),
            ("PUT", "/{group_id}/members/{user_id}/role"),
            ("GET", "/{group_id}/membership"),
        }

        self.assertEqual(expected, set(declarations))
        self.assertEqual(8, len(declarations))
        self.assertEqual(8, len({path for _, path in declarations}))


if __name__ == "__main__":
    unittest.main()
