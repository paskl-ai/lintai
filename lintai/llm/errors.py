class BudgetExceededError(RuntimeError):
    """Raised when the global LLM token / cost budget is exceeded."""
