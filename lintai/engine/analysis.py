# In lintai/engine/analysis.py

"""lintai.engine.analysis
========================
Core utilities to (1) detect *direct* LLM / Gen‑AI invocations and
(2) construct a cross‑module call‑graph so we can tag *wrapper*
functions up to an arbitrary depth.

`ProjectAnalyzer` does a **two‑phase** pass over every `PythonASTUnit`:

1.  *Module pass* – resolves import/alias information and records
    **direct AI calls** (sinks).
2.  *Link pass*   – builds a *call‑graph* between user‑defined functions
    and propagates the *ai_sink* flag outward up to a configurable depth.

The result is available via:

    analyzer.ai_calls        # list[AICall]
    analyzer.ai_functions    # set[QualifiedName] – any func/method that
                            # is (directly or indirectly) in an AI chain
    analyzer.call_graph      # dict[QualifiedName, set[QualifiedName]]
"""

from __future__ import annotations

import ast
import os
import logging
import re
import networkx as nx
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Iterable, Mapping, MutableMapping, Set
from networkx.readwrite import json_graph

from lintai.models.inventory import FileInventory, Component, Relationship
from lintai.engine.ast_utils import get_full_attr_name, get_code_snippet
from lintai.engine.classification import classify_component_type, detect_frameworks
from lintai.engine.python_ast_unit import PythonASTUnit

# ---------------------------------------------------------------------------#
# helper: path  →   import-style module name                                 #
# ---------------------------------------------------------------------------#
_NON_ID = re.compile(r"\W+")


def _path_to_modname(project_root: Path, path: Path) -> str:
    """
    <root>/pkg/sub/mod.py   →   "pkg.sub.mod"
    Non-identifier parts (dash, space, etc.) are replaced by "_".
    """
    if path == project_root:
        rel = path.with_suffix("")  # single-file case
    else:
        rel = path.relative_to(project_root).with_suffix("")
    parts = [_NON_ID.sub("_", p) for p in rel.parts]
    return ".".join(parts)


def _node_at_lineno(tree: ast.AST, lineno: int) -> ast.AST | None:
    for node in ast.walk(tree):
        if hasattr(node, "lineno") and node.lineno == lineno:
            return node
    return None


###############################################################################
# 0.  Public dataclasses ######################################################
###############################################################################
@dataclass(slots=True, frozen=True)
class AICall:
    """A single call site that directly invokes an LLM/embedding provider."""

    fq_name: str  # e.g. "openai.ChatCompletion.create"
    file: Path
    lineno: int

    def as_dict(self) -> dict:  # convenience for JSON report
        return {"name": self.fq_name, "file": str(self.file), "line": self.lineno}


###############################################################################
# 1.  Regex patterns ##########################################################
###############################################################################
_PROVIDER_RX = re.compile(
    r"""
        \b(
            openai | anthropic | cohere | ai21 | mistral | together_ai? |
            google\.generativeai | gpt4all | ollama |

            # Frameworks / SDKs
            langchain | langgraph | llama_index | litellm | guidance |
            autogen | autogpt | crewai |

            # Enterprise & platform SDKs
            servicenow | nowassist | salesforce\.einstein | einstein_gpt |
            semantickernel | promptflow | vertexai |
            boto3\.bedrock | bedrock_runtime | sagemaker |
            watsonx | snowflake\.cortex | snowpark_llm |

            # Vendor wrappers
            chatopenai | azurechatopenai | togetherai |

            # Vector DB / embedding infra
            chromadb | pinecone | weaviate |

            # HuggingFace transformers & inference API
            transformers | huggingface_hub |

            # azure‑openai client class
            AzureOpenAI
        )\b
    """,
    re.I | re.X,
)

_VERB_RX = re.compile(
    r"""
        \b(
            chat | complete|completions? | generate|predict |
            invoke|run|call|answer|ask |
            stream|streaming | embed|embedding|embeddings |
            encode|decode | transform|translate|summar(y|ize) |
            agent(_run)?
        )_?
    """,
    re.I | re.X,
)


###############################################################################
# 2.  Internal helpers ########################################################
###############################################################################
class _ImportTracker:
    """Keeps an alias‑map for a single module (file)."""

    def __init__(self) -> None:
        self.aliases: dict[str, str] = {}

    # ---------------------------------------------------------------------
    def visit_import(self, node: ast.AST) -> None:
        if isinstance(node, ast.Import):
            for alias in node.names:
                self.aliases[alias.asname or alias.name.split(".")[0]] = alias.name
        elif isinstance(node, ast.ImportFrom):
            root = node.module or ""
            for alias in node.names:
                full = f"{root}.{alias.name}" if root else alias.name
                self.aliases[alias.asname or alias.name] = full

    # ---------------------------------------------------------------------
    def resolve(self, name: str) -> str:
        """Return fully‑qualified module/class name if alias is known."""
        return self.aliases.get(name, name)


# ---------------------------------------------------------------------------
class _AttrChain:
    @staticmethod
    def parts(node: ast.AST) -> list[str]:
        parts: list[str] = []
        while isinstance(node, ast.Attribute):
            parts.append(node.attr)
            node = node.value
        if isinstance(node, ast.Name):
            parts.append(node.id)
        return list(reversed(parts))

    @staticmethod
    def to_dotted(parts: list[str]) -> str:
        return ".".join(parts)


###############################################################################
# 3.  Phase‑1 visitor – collect aliases & sinks ###############################
###############################################################################
class _PhaseOneVisitor(ast.NodeVisitor):
    """Walk a module AST once to collect alias info *and* direct AI calls."""

    def __init__(
        self, unit: PythonASTUnit, tracker: _ImportTracker, sinks: list[AICall]
    ):
        self.unit = unit
        self.tracker = tracker
        self.sinks = sinks

    # ---------------------------------------------------------------------
    def visit_Import(self, node):
        self.tracker.visit_import(node)
        self.generic_visit(node)

    visit_ImportFrom = visit_Import  # alias

    # Inspect code with function calls to find AI calls
    def visit_Call(self, node: ast.Call):
        parts = _AttrChain.parts(node.func)
        if not parts:
            return
        base, *rest = parts
        base_resolved = self.tracker.resolve(base)
        dotted = ".".join([base_resolved, *rest])

        if _PROVIDER_RX.search(dotted):
            self.sinks.append(AICall(dotted, self.unit.path, node.lineno))
        else:
            # Heuristic: verb at the end + base looks like provider
            if (
                rest
                and _VERB_RX.search(rest[-1])
                and _PROVIDER_RX.search(base_resolved)
            ):
                self.sinks.append(AICall(dotted, self.unit.path, node.lineno))
        self.generic_visit(node)

    # Inspect code with binary operators to find agentic AI calls
    def visit_BinOp(self, node: ast.BinOp):
        if isinstance(node.op, ast.BitOr):
            for side in (node.left, node.right):
                parts = _AttrChain.parts(side)
                if parts:
                    base = self.tracker.resolve(parts[0])
                    if _PROVIDER_RX.search(base):
                        dotted = "|".join(
                            [
                                _AttrChain.to_dotted(_AttrChain.parts(node.left)),
                                _AttrChain.to_dotted(_AttrChain.parts(node.right)),
                            ]
                        )
                        self.sinks.append(AICall(dotted, self.unit.path, node.lineno))
                        break
        self.generic_visit(node)

    # Inspect code with assignment to find assignments to AI libraries
    def visit_Assign(self, node: ast.Assign):
        # e.g. pattern:  <n> = <Call to AzureOpenAI / openai.Client()>
        if (
            len(node.targets) == 1
            and isinstance(node.targets[0], ast.Name)
            and isinstance(node.value, ast.Call)
        ):
            func_parts = _AttrChain.parts(node.value.func)
            if func_parts and _PROVIDER_RX.search(".".join(func_parts)):
                # map  client  ->  openai
                self.tracker.aliases[node.targets[0].id] = func_parts[0]
        elif isinstance(node.value, ast.Name):
            # e.g. foo = generate_ai_response
            target, source = node.targets[0], node.value
            if isinstance(target, ast.Name):
                full = self.tracker.resolve(source.id)
                self.tracker.aliases[target.id] = full
        elif isinstance(node.value, ast.Attribute):
            # e.g. self.llm = client.chat
            parts = _AttrChain.parts(node.value)
            if parts and _PROVIDER_RX.search(".".join(parts)):
                lhs = node.targets[0]
                if isinstance(lhs, ast.Attribute) and isinstance(lhs.attr, str):
                    self.tracker.aliases[lhs.attr] = _AttrChain.to_dotted(parts)

        self.generic_visit(node)


###############################################################################
# 4.  Phase‑2 visitor – build call graph #####################################
###############################################################################
class _PhaseTwoVisitor(ast.NodeVisitor):
    """Collect def‑name and outgoing calls for user code."""

    def __init__(
        self,
        module_name: str,
        tracker: _ImportTracker,
        _call_graph: MutableMapping[str, Set[str]],
        pa: "ProjectAnalyzer",
    ):
        self.mod = module_name
        self.log = logging.getLogger(__name__)
        self.tracker = tracker
        self._call_graph = _call_graph
        self.pa = pa
        self.current_func: list[str] = []  # stack of qualified names

    # Helper ----------------------------------------------------------------
    def _qual(self, name: str) -> str:
        return (
            f"{self.mod}.{'.'.join(self.current_func+[name])}"
            if self.current_func
            else f"{self.mod}.{name}"
        )

    # Visit defs ------------------------------------------------------------
    def visit_FunctionDef(self, node: ast.FunctionDef):
        qname = self._qual(node.name)
        self.current_func.append(node.name)
        self.generic_visit(node)
        self.current_func.pop()

    visit_AsyncFunctionDef = visit_FunctionDef

    # Visit calls -----------------------------------------------------------
    def visit_Call(self, node: ast.Call):
        if not self.current_func:
            # we only care about calls *inside* a function/method
            self.generic_visit(node)
            return
        caller = f"{self.mod}.{'.'.join(self.current_func)}"

        # --------- direct call  foo.bar()  -----------------------------
        parts = _AttrChain.parts(node.func)
        if not parts:
            self.generic_visit(node)
            return
        callee = self._resolve_parts(parts)
        if callee:
            self._call_graph[caller].add(callee)
            self.log.debug(
                "P2-EDGE  %s  →  %s  (line %s)",
                caller,
                callee,
                getattr(node, "lineno", "?"),
            )

        # --------- HOF / callback  some_helper(process_message_sync) ---
        def _maybe_add(expr: ast.AST) -> None:
            if isinstance(expr, (ast.Name, ast.Attribute)):
                parts = _AttrChain.parts(expr)
                if parts:
                    tgt = self._resolve_parts(parts)
                    if tgt and tgt != caller:
                        self._call_graph[caller].add(tgt)
                        self.log.debug(
                            "P2-EDGE(HOF)  %s  →  %s  (line %s)",
                            caller,
                            tgt,
                            getattr(expr, "lineno", "?"),
                        )

        for arg in node.args:
            _maybe_add(arg)
        for kw in node.keywords:
            _maybe_add(kw.value)

        self.generic_visit(node)

    # ---------------------------------------------------------------------
    def _resolve_parts(self, parts: list[str]) -> str | None:
        """Best‑effort resolution to a qualified name within project; fall back to dotted string."""
        base, *rest = parts
        base_resolved = self.tracker.resolve(base)
        dotted = ".".join([base_resolved, *rest])

        # If `base` didn't resolve to an import alias and has no dots,
        # assume it's a *local* symbol in the current module.
        if "." not in dotted and base == base_resolved:
            dotted = f"{self.mod}.{dotted}"
        return dotted


###############################################################################
# 5.  Public driver ###########################################################
###############################################################################
class ProjectAnalyzer:
    """Run both phases over all PythonASTUnits and expose results."""

    def __init__(self, units: Iterable[PythonASTUnit], call_depth: int = 2):
        self.log = logging.getLogger(__name__)
        self.units = list(units)
        self.call_depth = call_depth
        # directory shared by *all* source files – used for nice mod-names
        if self.units:
            self.root = Path(os.path.commonpath(u.path for u in self.units))
        else:
            # If no Python files found, use current working directory
            self.root = Path.cwd()

        # AI call analysis state
        self._trackers: dict[Path, _ImportTracker] = {}
        self._ai_sinks: list[AICall] = []
        self._call_graph: dict[str, Set[str]] = defaultdict(set)
        self._ai_funcs: Set[str] = set()
        self._nodes: dict[int, ast.AST] = {}  # id(node) -> node
        self._units_by_node: dict[ast.AST, PythonASTUnit] = {}
        self._id_to_qname: dict[int, str] = {}
        self._qname_to_id: dict[str, int] = {}
        self._nx_graph = nx.DiGraph()
        self._where: dict[str, tuple[PythonASTUnit, ast.AST]] = {}
        self.ai_modules: set[str] = set()

        # cache: file path → derived module name (sanitised, root-relative)
        self._modnames = {
            u.path: _path_to_modname(self.root, u.path) for u in self.units
        }

        # Ensure consistent modname format between units and analyzer
        for unit in self.units:
            unit.modname = self._modnames[unit.path]

        # Add _qualname_to_node mapping for detector compatibility
        self._qualname_to_node: dict[str, ast.AST] = {}

        # Component inventory state (for backward compatibility)
        self.inventories: Dict[str, FileInventory] = {}
        self._component_map = {}  # name -> component (for deduplication/merging)

    def analyze(self) -> "ProjectAnalyzer":
        """Main entry point - run both phases and build component inventories."""
        # Handle empty units gracefully (no Python files to analyze)
        if not self.units:
            self.log.info("No Python files found to analyze")
            return self

        self._phase_one()
        self._phase_two()
        self._propagate_ai_tags()
        self._mark_ai_modules()
        self._build_component_inventories()
        return self

    # ------------------------------------------------------------------
    def _phase_one(self):
        """Phase 1: collect import aliases and direct AI sinks."""
        for unit in self.units:
            tracker = _ImportTracker()
            self._trackers[unit.path] = tracker
            visitor = _PhaseOneVisitor(unit, tracker, self._ai_sinks)
            visitor.visit(unit.tree)
        self.log.info("Phase‑1: found %d direct AI calls", len(self._ai_sinks))

    # ------------------------------------------------------------------
    def _phase_two(self):
        """Phase 2: build call graph between user-defined functions."""
        for unit in self.units:
            mod_name = self._modnames[unit.path]
            tracker = self._trackers[unit.path]
            visitor = _PhaseTwoVisitor(mod_name, tracker, self._call_graph, pa=self)

            visitor.visit(unit.tree)
            # ─── gather every Def/Lambda so detectors can ask for source later ───
            for node in ast.walk(unit.tree):
                if isinstance(
                    node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)
                ):
                    q = unit.qualname(node)
                    self._where[q] = (unit, node)
                    self._nodes[id(node)] = node
                    self._units_by_node[node] = unit
                    self._id_to_qname[id(node)] = q
                    self._qname_to_id[q] = id(node)
                    # Populate _qualname_to_node for detector compatibility
                    self._qualname_to_node[q] = node
                    # Lambdas are anonymous – they have no `.name` attribute.
                    if hasattr(node, "name"):
                        plain = f"{self._modnames[unit.path]}.{node.name}"
                        # Also map the plain name for compatibility
                        self._qualname_to_node[plain] = node
                    else:  # ast.Lambda → give it a synthetic, lineno-based label
                        plain = f"{self._modnames[unit.path]}.<lambda>@{getattr(node, 'lineno', 0)}"

                    self._qname_to_id.setdefault(plain, id(node))
                    self._nx_graph.add_node(id(node))

        # ── after *all* units are processed we finally connect the graph IDs ──
        for caller, callees in self._call_graph.items():
            src_id = self._qname_to_id.get(caller)
            if src_id is None:
                continue
            for callee in callees:
                dst_id = self._qname_to_id.get(callee)
                if dst_id is not None:
                    self._nx_graph.add_edge(src_id, dst_id)

        self.log.debug(
            "Phase-2: constructed call graph with %d edges",
            self._nx_graph.number_of_edges(),
        )

    # ------------------------------------------------------------------
    def _propagate_ai_tags(self):
        """Propagate AI tags up the call graph to mark wrapper functions."""
        # 1️⃣  start set = every *direct* sink's enclosing def (or module)
        sink_funcs: Set[str] = set()
        for call in self._ai_sinks:
            # Walk parents until FunctionDef / AsyncFunctionDef or Module
            unit = next(u for u in self.units if u.path == call.file)
            node = _node_at_lineno(unit.tree, call.lineno)
            while node and not isinstance(
                node, (ast.FunctionDef, ast.AsyncFunctionDef)
            ):
                node = getattr(node, "parent", None)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                sink_funcs.add(f"{self._modnames[unit.path]}.{node.name}")
            else:  # module-level statement
                sink_funcs.add(self._modnames[unit.path])

        # but we can do better: when PhaseTwo built edges caller->callee
        for caller, callees in self._call_graph.items():
            if any(_PROVIDER_RX.search(c) for c in callees):
                sink_funcs.add(caller)

        self._ai_funcs = set(sink_funcs)
        # BFS up the graph
        frontier = set(sink_funcs)
        depth = 0
        while frontier and depth < self.call_depth:
            # ① try strict match first ------------------------------------
            parents = {
                caller
                for caller, callees in self._call_graph.items()
                if callees & frontier
            }

            # ② fallback: match on *basename* (last segment) ---------------
            if not parents:
                frontier_basenames = {f.split(".")[-1] for f in frontier}
                parents = {
                    caller
                    for caller, callees in self._call_graph.items()
                    if {c.split(".")[-1] for c in callees} & frontier_basenames
                }

            new = parents - self._ai_funcs
            if not new:
                break
            self._ai_funcs.update(new)
            frontier = new
            depth += 1
        self.log.info(
            "Propagated AI tags to %d functions (depth %d)", len(self._ai_funcs), depth
        )

    def _mark_ai_modules(self) -> None:
        """Mark units as AI modules based on detected AI components."""
        # 1️⃣ sink files
        for call in self._ai_sinks:
            self.ai_modules.add(call.file.as_posix())

        # 2️⃣ files defining an AI-tagged function
        for fn in self._ai_funcs:
            entry = self._where.get(fn)
            if entry:
                u, _ = entry
                self.ai_modules.add(u.path.as_posix())

        # 3️⃣ one-hop callers
        for caller, callees in self._call_graph.items():
            entry = self._where.get(caller)
            if entry:
                u, _ = entry
                self.ai_modules.add(u.path.as_posix())

        # tag the unit as an ai module for quick lookups
        for u in self.units:
            u.is_ai_module = u.path.as_posix() in self.ai_modules

    def _build_component_inventories(self):
        """Build component inventories for backward compatibility with existing code."""
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
                    # Deduplication: if a component with this name exists, merge/replace as needed
                    existing = self._component_map.get(component.name)
                    if existing:
                        # Prefer real location/code_snippet over stub
                        if (
                            existing.location == "unknown" or not existing.code_snippet
                        ) and (
                            component.location != "unknown" and component.code_snippet
                        ):
                            existing.location = component.location
                            existing.code_snippet = component.code_snippet
                            existing.component_type = component.component_type
                        # Always merge call_chain and relationships
                        existing.call_chain = list(
                            set(existing.call_chain + component.call_chain)
                        )
                        existing.relationships.extend(
                            [
                                r
                                for r in component.relationships
                                if r not in existing.relationships
                            ]
                        )
                    else:
                        inventory.add_component(component)
                        self._component_map[component.name] = component
                    self._map_relationships(
                        self._component_map[component.name], node, unit
                    )

        # === Populate Call Chains from Graph ===
        for inventory in self.inventories.values():
            for component in inventory.components:
                # Use our sophisticated call graph instead of NetworkX
                if component.name in self._ai_funcs:
                    # Find callers of this component
                    callers = [
                        caller
                        for caller, callees in self._call_graph.items()
                        if component.name in callees
                    ]
                    component.call_chain = callers

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

    def _map_relationships(
        self, component: Component, node: ast.AST, unit: PythonASTUnit
    ):
        """Map relationships between components using our sophisticated call graph."""
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
            # Use our sophisticated call graph to find relationships
            func_qualname = unit.qualname(node)
            if func_qualname in self._call_graph:
                for callee in self._call_graph[func_qualname]:
                    component.relationships.append(
                        Relationship(target_name=callee, type="calls")
                    )

            # Find "uses" relationships for the function's parameters
            for arg in node.args.args:
                if arg.arg == "self":
                    continue
                component.relationships.append(
                    Relationship(target_name=arg.arg, type="uses")
                )

    # ------------------------------------------------------------------
    # Exposed properties for compatibility with ai_call_analysis
    # ------------------------------------------------------------------
    @property
    def ai_calls(self) -> list[AICall]:
        return self._ai_sinks

    @property
    def ai_functions(self) -> Set[str]:
        return self._ai_funcs

    @property
    def call_graph(self) -> Mapping[str, Set[str]]:
        return self._call_graph

    @property
    def qualname_to_node(self) -> Dict[str, ast.AST]:
        """Mapping from qualified function name to AST node for detector compatibility."""
        return self._qualname_to_node

    # ------------------------------------------------------------------
    # Additional methods for llm_code_audit.py compatibility
    # ------------------------------------------------------------------
    def callers_of(self, qname: str) -> List[str]:
        """Return list of function names that call the given qualified name."""
        callers = []
        for caller, callees in self._call_graph.items():
            if qname in callees:
                callers.append(caller)
        return callers

    def callees_of(self, qname: str) -> List[str]:
        """Return list of function names called by the given qualified name."""
        return list(self._call_graph.get(qname, []))

    def source_of(self, qname: str) -> tuple[PythonASTUnit, ast.AST]:
        """Return (unit, node) tuple for the given qualified function name."""
        if qname in self._where:
            return self._where[qname]
        # If not found, try to construct a dummy response to avoid crashes
        # This shouldn't happen in practice if call graph is correctly built
        raise KeyError(f"No source found for qualified name: {qname}")


# ---------------------------------------------------------------------------
# 6.  External API functions for compatibility
# ---------------------------------------------------------------------------


def is_ai_call(node: ast.Call) -> bool:
    """
    Return *True* when the Call ultimately resolves to one of the AI sinks or
    AI tagged functions.  We first try an exact dotted match; if that fails we
    resolve the leading alias with the module's _ImportTracker.
    """
    from lintai.engine import ai_analyzer

    analyzer = ai_analyzer

    log = logging.getLogger(__name__)

    if analyzer is None:
        log.error("is_ai_call ✖ no analyser")  # not initialised yet
        return False

    parts = _AttrChain.parts(node.func)
    if not parts:
        return False

    # fast-path — literal match
    dotted = ".".join(parts)
    if any(dotted == c.fq_name for c in analyzer.ai_calls):
        return True

    # match functions that were tagged by the call-graph pass
    unit = getattr(node, "_unit", None)  # type: PythonASTUnit | None
    if unit is not None:

        def _resolve_to_qname(parts: list[str]) -> str:
            """Best-effort resolution of <parts> to a fully-qualified name."""
            base, *rest = parts
            tracker = analyzer._trackers.get(unit.path)
            base_resolved = tracker.resolve(base) if tracker else base
            dotted = ".".join([base_resolved, *rest])
            # if it still looks local, prefix the module name
            if "." not in dotted and base == base_resolved:
                dotted = f"{unit.modname}.{dotted}"
            return dotted

        qname = _resolve_to_qname(parts)
        if qname in analyzer.ai_functions:  # ← wrapper/helper detected
            return True

    # alias-aware match
    unit = getattr(node, "_unit", None)
    if unit and unit.path in analyzer._trackers:
        tracker = analyzer._trackers[unit.path]
        base, *rest = parts
        dotted_resolved = ".".join([tracker.resolve(base), *rest])
        if any(dotted_resolved == c.fq_name for c in analyzer.ai_calls):
            return True

    return False


def is_ai_function_qualname(qualname: str) -> bool:
    """True iff *qualname* (module.func) is in an AI chain."""
    from lintai.engine import ai_analyzer

    return ai_analyzer is not None and qualname in ai_analyzer.ai_functions


def is_ai_module_path(unit_or_path) -> bool:
    """
    Return True iff the given *PythonASTUnit* **or** path string belongs
    to a module that the analyser has classified as AI-related.
    """
    from pathlib import Path
    from lintai.engine import ai_analyzer

    if ai_analyzer is None:
        return False

    if hasattr(unit_or_path, "path"):  # PythonASTUnit
        p = unit_or_path.path
    else:  # str | Path
        p = Path(str(unit_or_path))

    return p.as_posix() in ai_analyzer.ai_modules
