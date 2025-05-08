from abc import ABC, abstractmethod
from pathlib import Path
from typing import Iterable


class SourceUnit(ABC):
    def __init__(self, path: Path):
        self.path = path

    @abstractmethod
    def joined_fstrings(self) -> Iterable: ...

    @abstractmethod
    def is_user_tainted(self, node) -> bool: ...

    @abstractmethod
    def has_call(self, name: str, node) -> bool: ...
