# In lintai/engine/analysis.py

# In lintai/engine/analysis.py
import ast
import networkx as nx
from collections import defaultdict
from typing import Dict, List, Optional

from lintai.models.inventory import FileInventory, Component, Relationship
from lintai.engine.ast_utils import get_full_attr_name, get_code_snippet
from lintai.engine.classification import classify_component_type, detect_frameworks
from lintai.engine.python_ast_unit import PythonASTUnit


class ProjectAnalyzer:
    def __init__(self, units: List[PythonASTUnit], call_depth: int = 2):
        self.units = units
        self.call_depth = call_depth
        self.inventories: Dict[str, FileInventory] = {}
        # Internal state for analysis
        self._call_graph = nx.DiGraph()
        self._qualname_to_node: Dict[str, ast.AST] = {}
        self._import_trackers: Dict[str, Dict[str, str]] = defaultdict(dict)
        self._variable_map: Dict[str, str] = (
            {}
        )  # Maps a variable name to its qualified type name

    def analyze(self) -> "ProjectAnalyzer":
        # === Pass 1: Gather Context (Imports & Definitions) ===
        for unit in self.units:
            self._track_imports_and_defs(unit.tree, unit)

        # === Pass 2: Create Components and Map Relationships ===
        for unit in self.units:
            inventory = FileInventory(
                file_path=str(unit.path),
                frameworks=detect_frameworks(unit.tree),
                components=[],
            )
            self.inventories[str(unit.path)] = inventory
            for node in ast.walk(unit.tree):
                component = self._node_to_component(node, unit)
                if component:
                    inventory.add_component(component)
                    self._map_relationships(component, node, unit)

        # === Pass 3: Populate Call Chains from Graph ===
        for inventory in self.inventories.values():
            for component in inventory.components:
                if self._call_graph.has_node(component.name):
                    component.call_chain = list(
                        self._call_graph.predecessors(component.name)
                    )

        # === Pass 4: Mark AI Modules ===
        self._mark_ai_modules()

        return self

    def _track_imports_and_defs(self, tree: ast.AST, unit: PythonASTUnit):
        for node in ast.walk(tree):
            path_str = str(unit.path)
            if isinstance(node, ast.Import):
                for alias in node.names:
                    self._import_trackers[path_str][
                        alias.asname or alias.name.split(".")[0]
                    ] = alias.name
            elif isinstance(node, ast.ImportFrom) and node.module:
                for alias in node.names:
                    self._import_trackers[path_str][
                        alias.asname or alias.name
                    ] = f"{node.module}.{alias.name}"
            elif isinstance(
                node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
            ):
                qualname = unit.qualname(node)
                self._qualname_to_node[qualname] = node
                self._call_graph.add_node(qualname)

    def _map_relationships(
        self, component: Component, node: ast.AST, unit: PythonASTUnit
    ):
        # This is the node that contains the core logic (e.g., the Call or BinOp)
        node_to_inspect = node
        if isinstance(node, ast.Assign):
            node_to_inspect = node.value

        # Find "uses" relationships from arguments in Calls
        if isinstance(node_to_inspect, ast.Call):
            args = [kw.value for kw in node_to_inspect.keywords] + node_to_inspect.args
            for arg_node in args:
                if isinstance(arg_node, ast.Name):
                    # This check should be against the component map, not just appending
                    component.relationships.append(
                        Relationship(target_name=arg_node.id, type="uses")
                    )

        # Find "uses" relationships from the LCEL Pipe Operator
        elif isinstance(node_to_inspect, ast.BinOp) and isinstance(
            node_to_inspect.op, ast.BitOr
        ):
            if isinstance(node_to_inspect.left, ast.Name):
                component.relationships.append(
                    Relationship(target_name=node_to_inspect.left.id, type="uses")
                )
            if isinstance(node_to_inspect.right, ast.Name):
                component.relationships.append(
                    Relationship(target_name=node_to_inspect.right.id, type="uses")
                )

        # --- THIS IS THE COMBINED BLOCK FOR FUNCTION DEFINITIONS ---
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):

            # 1. Find outgoing "calls" relationships (your existing logic)
            for sub_node in ast.walk(node):
                if isinstance(sub_node, ast.Call):
                    callee_qualname = self._resolve_call_to_qualname(
                        sub_node.func, unit
                    )
                    if callee_qualname:
                        # Check if the callee is a known function definition before adding the edge
                        if self._call_graph.has_node(callee_qualname):
                            self._call_graph.add_edge(component.name, callee_qualname)
                            component.relationships.append(
                                Relationship(target_name=callee_qualname, type="calls")
                            )

            # 2. Find "uses" relationships for the function's parameters (the new logic)
            for arg in node.args.args:
                if arg.arg == "self":
                    continue
                component.relationships.append(
                    Relationship(target_name=arg.arg, type="uses")
                )

    def _resolve_call_to_qualname(
        self, func_node: ast.AST, unit: PythonASTUnit
    ) -> Optional[str]:
        if isinstance(func_node, ast.Name):
            func_id = func_node.id
            if func_id in self._import_trackers[str(unit.path)]:
                return self._import_trackers[str(unit.path)][func_id]
            qualname = f"{unit.modname}.{func_id}"
            if qualname in self._qualname_to_node:
                return qualname
        elif isinstance(func_node, ast.Attribute):
            return get_full_attr_name(func_node)
        return None

    def _node_to_component(
        self, node: ast.AST, unit: PythonASTUnit
    ) -> Optional[Component]:
        """
        Inspects a single AST node and creates a Component object if it represents
        a significant AI-related element (e.g., a call, assignment, or definition).
        """
        name = ""
        component_type = "Unknown"

        if isinstance(node, ast.Call):
            if not isinstance(node.func, (ast.Name, ast.Attribute)):
                return None
            name = get_full_attr_name(node.func)
            component_type = classify_component_type(name)
        elif isinstance(node, ast.Assign):
            if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                # If the value is a function call, check its type
                if isinstance(node.value, ast.Call):
                    call_name = get_full_attr_name(node.value.func)
                    call_type = classify_component_type(call_name)
                    # Only create a component for the variable if the call is a known AI type (not LLM)
                    if call_type not in ["Unknown", "Ignore", "LLM"]:
                        name = node.targets[0].id
                        component_type = call_type
                    else:
                        return None
                elif isinstance(
                    node.value, (ast.BinOp, ast.Dict, ast.List, ast.Constant)
                ):
                    value_name = node.targets[0].id
                    value_type = classify_component_type(value_name)
                    if value_type not in ["Unknown", "Ignore", "LLM"]:
                        name = node.targets[0].id
                        component_type = value_type
                    elif "prompt" in node.targets[0].id.lower():
                        name = node.targets[0].id
                        component_type = "Prompt"
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            name = unit.qualname(node)
            is_tool = False
            for decorator in node.decorator_list:
                decorator_name = ""
                if isinstance(decorator, ast.Name):
                    decorator_name = decorator.id
                elif isinstance(decorator, ast.Call):
                    decorator_name = get_full_attr_name(decorator.func)
                if decorator_name == "tool":
                    is_tool = True
                    break
            if is_tool:
                component_type = "Tool"
            else:
                component_type = "Function"

        if not name or component_type in ["Ignore", "Unknown"]:
            return None
        return Component(
            name=name,
            component_type=component_type,
            location=f"{str(unit.path)}:{getattr(node, 'lineno', 0)}",
            code_snippet=get_code_snippet(unit.source, node),
        )

    def _find_enclosing_function(self, node: ast.AST) -> Optional[ast.AST]:
        current = getattr(node, "parent", None)
        while current:
            if isinstance(current, (ast.FunctionDef, ast.AsyncFunctionDef)):
                return current
            current = getattr(current, "parent", None)
        return None

    def _mark_ai_modules(self):
        """
        Sets the .is_ai_module flag on any SourceUnit that contains
        at least one AI component in our final inventory.
        """
        # Find all file paths that have AI components
        ai_files = set()
        for inventory in self.inventories.values():
            if inventory.components:
                ai_files.add(inventory.file_path)

        # Set the flag on the corresponding unit objects
        for unit in self.units:
            if str(unit.path) in ai_files:
                unit.is_ai_module = True
