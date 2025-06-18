import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router';
import CytoscapeGraph from '../../components/cytoscapegraph/CytoscapeGraph';

interface DataFlowVisualiseProps {
  records?: {
    elements:{ nodes?: any[];
        edges?: any[];}

  };
}

const DataFlowVisualise = ({ elements }) => {
  const allNodes = elements?.nodes || [];
  const allEdges = elements?.edges || [];

  const entityTypes = useMemo(() => {
    if (!allNodes) return [];
    const types = Array.from(new Set(allNodes.map(n => n.data.type).filter(Boolean)));
    return types.map(type => ({ label: type, value: type }));
  }, [allNodes]);

  const [entityFilter, setEntityFilter] = useState([]);

  const handleEntityFilterChange = (value) => {
    setEntityFilter(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const filteredNodes = useMemo(() => {
    if (entityFilter.length === 0) return allNodes;
    return allNodes.filter(n => entityFilter.includes(n.data.type));
  }, [allNodes, entityFilter]);

  const allowedIds = useMemo(() => new Set(filteredNodes.map(n => n.data.id)), [filteredNodes]);
  
  const filteredEdges = useMemo(() => 
    allEdges.filter(e => allowedIds.has(e.data.source) && allowedIds.has(e.data.target)),
    [allEdges, allowedIds]
  );

  return (
    <div className="flex flex-col h-full w-full">
      {entityTypes?.length > 0 && (
        <div className="flex flex-wrap items-center space-x-4 mb-4 p-3">
            {entityTypes.map(et => (
              <label key={et.value} className="inline-flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  checked={entityFilter.includes(et.value)}
                  onChange={() => handleEntityFilterChange(et.value)}
                />
                <span className="text-sm text-gray-700">{et.label}</span>
              </label>
            ))}
        </div>
      )}
      <div className="flex-grow">
        <CytoscapeGraph nodes={filteredNodes} edges={filteredEdges} />
      </div>
    </div>
  );
};

export default DataFlowVisualise;
