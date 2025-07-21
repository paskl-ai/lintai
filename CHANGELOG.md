# Changelog

All notable changes to Lintai will be### Usage Examples

**New Command Syntax:**

```bash
# Security vulnerability analysis
lintai find-issues file1.py file2.py directory/
lintai find-issues examples/main.py examples/chatbot.py -l DEBUG

# AI component cataloging
lintai catalog-ai examples/ --graph
lintai catalog-ai src/ --output ai-inventory.json
```

**Previous Commands (Deprecated):**

````bash
# Old syntax (still works but deprecated)
lintai scan examples/
lintai ai-inventory examples/
``` file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-07-20

### 🚀 Major Release - Complete Terminology Overhaul & Feature Enhancements

### ⚠️ Breaking Changes

- **CLI Commands Renamed**:
  - `lintai scan` → `lintai find-issues`
  - `lintai ai-inventory` → `lintai catalog-ai`
- **API Endpoints Renamed**:
  - `/api/scan` → `/api/find-issues`
  - `/api/inventory` → `/api/catalog-ai`
  - `/api/inventory/{rid}/subgraph` → `/api/catalog/{rid}/subgraph`

### Added

- **New Security Detectors**:
  - `LLM02`: Secret-in-prompt detector for hardcoded API keys and sensitive data
  - `LLM06`: Excessive agency detector for overprivileged AI components
- **Complete Frontend Overhaul**:
  - Modern React-based UI with pagination and improved navigation
  - Dedicated "Security Findings" and "AI Catalog" pages with clear separation
  - Real-time job tracking with WebSocket-like updates
  - Enhanced dashboard with meaningful statistics and history
  - Comprehensive settings page with API key management
- **Multi-file CLI support**: Both `find-issues` and `catalog-ai` commands now accept multiple files and directories as arguments
- **Cross-file analysis**: Enhanced analysis engine tracks function calls and AI usage patterns across file boundaries
- **Enhanced LLM detector context**: LLM-powered detectors now receive caller/callee context from other files for improved security analysis
- **Call-flow context in prompts**: LLM audit prompts include snippets from calling functions across files
- **Improved graph export**: Call graph visualization includes complete function→function→AI component chains
- **Mixed argument support**: CLI commands support mixing individual files and directories in the same command
- **Pagination support**: Frontend and API endpoints now support proper pagination for large datasets
- **CI/CD Pipeline**: Automated frontend build and deployment workflow

### Enhanced

- **Terminology Consistency**: Clear distinction between "Security Findings" (vulnerabilities) and "AI Catalog" (component inventory)
- **User Experience**: Intuitive navigation, consistent labeling, and improved error handling
- **Analysis engine**: Integrated AI call tracking and cross-file relationship mapping
- **Error handling**: Better handling for external library calls and edge cases
- **CLI argument parsing**: Robust handling of multiple paths and mixed arguments
- **Budget management**: Token tracking and cost estimation across multi-file analysis

### Usage Examples

**New Command Syntax:**
```bash
# Security vulnerability analysis
lintai find-issues file1.py file2.py directory/
lintai find-issues examples/main.py examples/chatbot.py -l DEBUG

# AI component cataloging
lintai catalog-ai examples/ --graph
lintai catalog-ai src/ --output ai-inventory.json
```

### Fixed

- Dashboard expansion behavior for security findings
- Frontend routing between findings and catalog pages
- Job type consistency across backend and frontend
- Error handling for empty Python file lists in catalog operations
- Build and deployment issues in CI/CD pipeline

---

## [0.0.2] - 2025-06-29

### New Features

- **New Analysis Engine** (by Hitesh Kapoor): Complete rewrite with `ProjectAnalyzer` class replacing `ai_call_analysis.py`
- **LLM06 Excessive Agency detector** (by Hitesh Kapoor): Detects dangerous function calls in agent tools
- **LLM02 Secret in Prompt detector** (by Hitesh Kapoor): Finds hardcoded secrets in prompt templates
- **Enhanced UI** (by Kundan Ray): React frontend improvements with better dashboard and visualization
- **FileInventory model**: Structured component inventory with relationships and call chains
- **AutoGen framework support**: Detection and classification of AutoGen agents and components
- CI/CD-based frontend workflow
- Graph output canonicalization for AI/LLM nodes

### Improvements

- **Component classification**: Better detection of AI frameworks and component types
- **Inventory builder**: Enhanced with relationship tracking and call chain analysis
- **Budget management**: Improved token tracking and cost management
- **API endpoints**: Enhanced REST API with better error handling and response formatting

### Bug Fixes

- Call graph output deduplication and performance improvements
- Frontend deployment and SPA routing
- Environment variable loading and CLI I/O handling
- AST unit building for better cross-file analysis

## [0.0.1] - Initial Release

### Core Features

- Core static analysis engine for AI/LLM code
- OWASP LLM Top-10 detectors
- OpenAI, Anthropic, Gemini, Cohere LLM provider support
- CLI commands: `find-issues`, `catalog-ai`, `ui`
- REST API with FastAPI backend
- Budget management and token tracking
- DSL for custom rules
- Basic cross-file analysis capabilities
