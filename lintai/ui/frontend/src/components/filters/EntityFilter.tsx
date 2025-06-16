import React from 'react';

interface EntityFilterProps {
    entityTypes: { label: string; value: string }[];
    selectedFilters: string[];
    onFilterChange: (value: string) => void;
    onClearFilters: () => void;
}

const EntityFilter: React.FC<EntityFilterProps> = ({ entityTypes, selectedFilters, onFilterChange, onClearFilters }) => {
    return (
        <div className="mb-8">
            <h3 className="font-bold mb-3 text-gray-700">Entity Types</h3>
            {entityTypes.map((entity) => (
                <div key={entity.value} className="flex items-center justify-between mb-3">
                    <label className="text-sm capitalize text-gray-600">{entity.label}</label>
                    <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-primary focus:ring-primary"
                        checked={selectedFilters.includes(entity.value)}
                        onChange={() => onFilterChange(entity.value)}
                    />
                </div>
            ))}
            <button
                className="font-bold text-primary mt-4 hover:underline"
                onClick={onClearFilters}
            >
                Clear filters
            </button>
        </div>
    );
};

export default EntityFilter;
