# Changelog

All notable changes to Lintai will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Multi-file CLI support**: Both `scan` and `ai-inventory` commands now accept multiple files and directories as arguments
- **Cross-file analysis**: Enhanced analysis engine tracks function calls and AI usage patterns across file boundaries
- **Enhanced LLM detector context**: LLM-powered detectors now receive caller/callee context from other files for improved security analysis
- **Call-flow context in prompts**: LLM audit prompts include snippets from calling functions across files
- **Improved graph export**: Call graph visualization includes complete function→function→AI component chains
- **Mixed argument support**: CLI commands support mixing individual files and directories in the same command

### Enhanced
- Analysis engine with integrated AI call tracking and cross-file relationship mapping
- Error handling for external library calls in context collection
- CLI argument parsing to handle multiple paths gracefully
- Budget management and token tracking across multi-file analysis

### Examples
- `lintai scan file1.py file2.py directory/`
- `lintai ai-inventory examples/ --graph`
- `lintai scan examples/main.py examples/chatbot.py -l DEBUG`

## [0.0.2] - 2025-06-29

### Added
- **New Analysis Engine** (by Hitesh Kapoor): Complete rewrite with `ProjectAnalyzer` class replacing `ai_call_analysis.py`
- **LLM06 Excessive Agency detector** (by Hitesh Kapoor): Detects dangerous function calls in agent tools
- **LLM02 Secret in Prompt detector** (by Hitesh Kapoor): Finds hardcoded secrets in prompt templates
- **Enhanced UI** (by Kundan Ray): React frontend improvements with better dashboard and visualization
- **FileInventory model**: Structured component inventory with relationships and call chains
- **AutoGen framework support**: Detection and classification of AutoGen agents and components
- CI/CD-based frontend workflow
- Graph output canonicalization for AI/LLM nodes

### Enhanced
- **Component classification**: Better detection of AI frameworks and component types
- **Inventory builder**: Enhanced with relationship tracking and call chain analysis
- **Budget management**: Improved token tracking and cost management
- **API endpoints**: Enhanced REST API with better error handling and response formatting

### Fixed
- Call graph output deduplication and performance improvements
- Frontend deployment and SPA routing
- Environment variable loading and CLI I/O handling
- AST unit building for better cross-file analysis

## [0.0.1] - Initial Release

### Added
- Core static analysis engine for AI/LLM code
- OWASP LLM Top-10 detectors
- OpenAI, Anthropic, Gemini, Cohere LLM provider support
- CLI commands: `scan`, `ai-inventory`, `ui`
- REST API with FastAPI backend
- Budget management and token tracking
- DSL for custom rules
- Basic cross-file analysis capabilities
