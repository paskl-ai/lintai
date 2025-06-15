# In lintai/models/inventory.py

from pydantic import BaseModel, Field
from typing import List, Optional

class Relationship(BaseModel):
    """Defines a directed link from one component to another."""
    target_name: str
    type: str  # e.g., "uses" or "calls"

class Component(BaseModel):
    """A single, identifiable component in the AI codebase."""
    component_type: str
    name: str
    location: str
    code_snippet: Optional[str] = None
    call_chain: List[str] = Field(default_factory=list, description="List of functions that call this component.")
    relationships: List[Relationship] = Field(default_factory=list, description="List of components that this component interacts with.")

class FileInventory(BaseModel):
    """A complete, unified inventory of all AI components within a single file."""
    file_path: str
    frameworks: List[str]
    components: List[Component]

    def add_component(self, component: Component):
        """A helper method to avoid adding duplicate components."""
        for existing_comp in self.components:
            if existing_comp.name == component.name and existing_comp.location == component.location:
                # If the new component has a more specific type, update the existing one
                if existing_comp.component_type == "Unknown" and component.component_type != "Unknown":
                    existing_comp.component_type = component.component_type
                return
        self.components.append(component)