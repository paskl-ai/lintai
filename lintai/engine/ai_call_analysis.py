"""lintai.engine.ai_call_analysis
=================================
Core utilities to (1) detect *direct* LLM / Gen‑AI invocations and
(2) construct a cross‑module call‑graph so we can tag *wrapper*
functions up to an arbitrary depth.

This module is **self‑contained** – import it from `lintai.engine.__init__`
or directly from detectors:

    from lintai.engine.ai_call_analysis import (
        ProjectAnalyzer,
        AICall,
    )

`ProjectAnalyzer` does a **two‑phase** pass over every `PythonASTUnit`
constructed by the Lintai engine:

1.  *Module pass* – resolves import/alias information and records
    **direct AI calls** (sinks).
2.  *Link pass*   – builds a *call‑graph* between user‑defined functions
    and propagates the *ai_sink* flag outward up to a configurable depth.

The result is available via:

    analyzer.ai_calls        # list[AICall]
    analyzer.ai_functions    # set[QualifiedName] – any func/method that
                            # is (directly or indirectly) in an AI chain
    analyzer.call_graph      # dict[QualifiedName, set[QualifiedName]]

These structures are cached on the `ProjectAnalyzer` instance and can be
queried by detectors to focus only on relevant code.

Add the CLI flag `--ai-call-depth N` via `lintai.cli` to control how far
upwards the tag propagation goes (default 2).
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
from typing import Iterable, Mapping, MutableMapping, Set
from networkx.readwrite import json_graph

from lintai.engine.python_ast_unit import PythonASTUnit

# ---------------------------------------------------------------------------#
# helper: path  →   import-style module name                                 #
# ---------------------------------------------------------------------------#
_NON_ID = re.compile(r"\W+")


def _path_to_modname(project_root: Path, path: Path) -> str:
    """
    <root>/pkg/sub/mod.py   →   "pkg.sub.mod"
    Non-identifier parts (dash, space, etc.) are replaced by “_”.
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
        # e.g. pattern:  <name> = <Call to AzureOpenAI / openai.Client()>
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

        # If `base` didn’t resolve to an import alias and has no dots,
        # assume it’s a *local* symbol in the current module.
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
        self.root = Path(os.path.commonpath(u.path for u in self.units))

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

    def _mark_ai_modules(self) -> None:
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

    # ------------------------------------------------------------------
    def analyze(self):
        self._phase_one()
        self._phase_two()

        self._propagate_ai_tags()
        self._mark_ai_modules()

        return self  # allow chaining

    # ──────────────────────────────────────────────────────────────
    #  helper – all simple Call → Call → … → sink paths
    # ──────────────────────────────────────────────────────────────
    def paths_to_sink(self, call_node: ast.Call) -> list[list[ast.AST]]:
        """
        Return **all** acyclic paths (DFS) from a project entry-point
        down to *call_node* (inclusive).  Every element in a path is an
        *ast.Call* or *ast.FunctionDef/Lambda* that lies on that route.
        """
        target = id(call_node)
        paths: list[list[ast.AST]] = []

        def _dfs(curr_id: int, stack: list[ast.AST]) -> None:
            if curr_id == target:
                paths.append(stack.copy())
                return
            for nxt in self._nx_graph.successors(curr_id):
                _dfs(nxt, stack + [self._nodes[nxt]])

        # roots = graph nodes with zero in-degree
        for root in (n for n in self._nx_graph if self._nx_graph.in_degree(n) == 0):
            _dfs(root, [self._nodes[root]])
        return paths

    #  simple helpers used by the LLM detector
    def callers_of(self, qualname: str) -> list[str]:
        nid = self._qname_to_id.get(qualname)
        if nid is None:
            return []
        return [self._id_to_qname[p] for p in self._nx_graph.predecessors(nid)]

    def callees_of(self, qualname: str) -> list[str]:
        nid = self._qname_to_id.get(qualname)
        if nid is None:
            return []
        return [self._id_to_qname[s] for s in self._nx_graph.successors(nid)]

    def source_of(self, qualname: str):
        """
        Return ``(PythonASTUnit, ast.AST)`` for *qualname* so detectors can
        fetch source text.  Raises *KeyError* when unknown.
        """
        return self._where[qualname]

    # ------------------------------------------------------------------
    def _phase_one(self):
        for unit in self.units:
            tracker = _ImportTracker()
            self._trackers[unit.path] = tracker
            visitor = _PhaseOneVisitor(unit, tracker, self._ai_sinks)
            visitor.visit(unit.tree)
        self.log.info("Phase‑1: found %d direct AI calls", len(self._ai_sinks))

    # ------------------------------------------------------------------
    def _phase_two(self):
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
                    # Lambdas are anonymous – they have no `.name` attribute.
                    if hasattr(node, "name"):
                        plain = f"{self._modnames[unit.path]}.{node.name}"
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

        """
        # ── DEBUG dump ───────────────────────────────────────────────
        self.log.debug("P2-SUMMARY  nodes=%d  string-edges=%d  nx-edges=%d",
                       len(self._nodes),
                       sum(len(v) for v in self._call_graph.values()),
                       self._nx_graph.number_of_edges())

        # which qualnames never got an id?
        dangling = [c for c in self._call_graph if c not in self._qname_to_id]
        if dangling:
            self.log.debug("P2-DANGLING  %d caller names missing id-map (first 10): %s",
                           len(dangling), dangling[:10])
        """
        self.log.debug(
            "Phase-2: constructed call graph with %d edges",
            self._nx_graph.number_of_edges(),
        )

    # ------------------------------------------------------------------
    def _propagate_ai_tags(self):
        # 1️⃣  start set = every *direct* sink’s enclosing def (or module)
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

    # --------------------------------------------------------------
    def _graph_for_sink(self, sink: AICall, depth: int) -> dict[str, list[dict]]:
        """
        Return {nodes, edges} for <sink> and all callers up to <depth>.
        """
        G = nx.DiGraph()

        # ①  BFS upward through call_graph, limited by depth
        frontier, seen, lvl = {sink.fq_name}, {sink.fq_name}, 0
        while frontier and lvl < depth:
            parents = {
                caller
                for caller, callees in self.call_graph.items()
                if callees & frontier
            }
            G.add_edges_from(
                (p, c) for p in parents for c in frontier if p != c  # ← skip self-loops
            )
            frontier = parents - seen
            seen |= parents
            lvl += 1

        # ②  ensure the sink itself is in the graph even if it has no callers
        G.add_node(sink.fq_name)

        # ③  decorate nodes with metadata for the UI
        for nid in G.nodes:
            if nid == sink.fq_name:
                G.nodes[nid]["label"] = "sink"
            else:
                G.nodes[nid]["label"] = "caller"

        return json_graph.cytoscape_data(G)["elements"]

    # ------------------------------------------------------------------
    # Exposed properties
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

    # ------------------------------------------------------------------
    # Public API for detectors and CLI/UI
    # ------------------------------------------------------------------
    def graph_for_sink(
        self, sink: AICall, depth: int | None = None
    ) -> dict[str, list[dict]]:
        """
        Convenience wrapper used by the CLI/UI.
        """
        return self._graph_for_sink(sink, depth or self.call_depth)


# ---------------------------------------------------------------------------
# 6.  External API – singleton instance for CLI/UI use #####################
# ---------------------------------------------------------------------------


def is_ai_call(node: ast.Call) -> bool:
    """
    Return *True* when the Call ultimately resolves to one of the AI sinks or
    AI tagged functions.  We first try an exact dotted match; if that fails we
    resolve the leading alias with the module’s _ImportTracker.
    """
    from lintai.engine import ai_analyzer

    analyzer = ai_analyzer

    log = logging.getLogger(__name__)
    # log.debug("is_ai_call called for %s", ast.get_source_segment(node._unit.source, node))

    if analyzer is None:
        log.error("is_ai_call ✖ no analyser")  # not initialised yet
        return False

    parts = _AttrChain.parts(node.func)
    if not parts:
        # log.debug("is_ai_call ✖ no parts") # no function name
        return False

    # fast-path — literal match
    dotted = ".".join(parts)
    if any(dotted == c.fq_name for c in analyzer.ai_calls):
        # log.debug("is_ai_call ✔ literal   %s", dotted)
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
            # log.debug("is_ai_call ✔ resolved %s  →  %s", dotted, dotted_resolved)
            return True
        # log.debug("is_ai_call ✖ resolved %s  →  %s", dotted, dotted_resolved)

    # log.debug("is_ai_call ✖ literal  %s", dotted)
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
