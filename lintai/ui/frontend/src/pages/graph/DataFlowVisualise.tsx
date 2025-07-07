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
    const types = Array.from(new Set(allNodes.map(n => n.data.label || n.data.type).filter(Boolean)));
    return types.map(type => ({ label: type.charAt(0).toUpperCase() + type.slice(1), value: type }));
  }, [allNodes]);

  const [entityFilter, setEntityFilter] = useState<string[]>([]);

  const handleEntityFilterChange = (value: string) => {
    setEntityFilter(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const filteredNodes = useMemo(() => {
    if (entityFilter.length === 0) return allNodes;
    return allNodes.filter(n => entityFilter.includes(n.data.label || n.data.type));
  }, [allNodes, entityFilter]);

  const allowedIds = useMemo(() => new Set(filteredNodes.map(n => n.data.id)), [filteredNodes]);
  
  const filteredEdges = useMemo(() => 
    allEdges.filter(e => allowedIds.has(e.data.source) && allowedIds.has(e.data.target)),
    [allEdges, allowedIds]
  );

  const componentColors: { [key: string]: string } = {
    file: '#FFD166',
    function: '#4ECDC4',
    agent: '#45B7D1',
    multiagent: '#96CEB4',
    tool: '#FFEAA7',
    ui: '#FD79A8',
    chain: '#A29BFE',
    lifecycle: '#6C5CE7',
    sink: '#FF6B6B',
    external: '#E17055',
  };

  return (
    <div className="flex flex-col h-full w-full">
      {entityTypes?.length > 0 && (
        <div className="flex flex-wrap items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex flex-wrap items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Filter by type:</span>
            {entityTypes.map(et => (
              <label key={et.value as string} className="inline-flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  checked={entityFilter.includes(et.value as string)}
                  onChange={() => handleEntityFilterChange(et.value as string)}
                />
                <div 
                  className="w-3 h-3 rounded-full mr-1"
                  style={{ backgroundColor: componentColors[et.value as string] || '#4A90E2' }}
                ></div>
                <span className="text-sm text-gray-700">{et.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="flex-grow">
        <CytoscapeGraph nodes={filteredNodes} edges={filteredEdges} />
      </div>
    </div>
  );
};

export default DataFlowVisualise;
