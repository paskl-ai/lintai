import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router';
import CytoscapeGraph from '../../components/cytoscapegraph/CytoscapeGraph';

interface DataFlowVisualiseProps {
  records?: {
    elements:{ nodes?: any[];
        edges?: any[];}
   
  };
}

const DataFlowVisualise: React.FC<DataFlowVisualiseProps> = ({ records }) => {
  const location = useLocation();
//   const { state } = location as { state: { record: any } };
  const { record } = location.state || {};
  const nodes: any[] = record?.nodes || records?.elements.nodes||[];
  const edges: any[] = record?.edges ||records?.elements.edges|| [];
console.log(records, 'Nodes and Edges');
  // Derive unique entity types directly from node data
  const entityTypes = useMemo(() => {
    const types = Array.from(
      new Set(nodes.map(n => n.data.type).filter(Boolean))
    );
    // Map to objects for label/value
    return types.map(type => ({
      label: type,
      value: type
    }));
  }, [nodes]);

  console.log(entityTypes, 'Entity Types');
  // State for selected entity filters
  const [entityFilter, setEntityFilter] = useState<string[]>([]);

  // Toggle filter selection
  const handleEntityFilterChange = (value: string) => {
    setEntityFilter(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  // Filter nodes: if filters applied, only keep matching types
  const filteredNodes = useMemo(() => {
    if (entityFilter.length === 0) return nodes;
    return nodes.filter(n => entityFilter.includes(n.data.type));
  }, [nodes, entityFilter]);

  // Filter edges: both ends must remain
  const allowedIds = useMemo(
    () => new Set(filteredNodes.map(n => n.data.id)),
    [filteredNodes]
  );
  const filteredEdges = useMemo(
    () => edges.filter(e => allowedIds.has(e.data.source) && allowedIds.has(e.data.target)),
    [edges, allowedIds]
  );

  return (
    <div className="flex flex-col h-screen w-full p-0">
      {/* Dynamic horizontal filter bar */}
    {entityTypes?.length>0&&  <div className="flex flex-wrap items-center space-x-4 mb-4 bg-white p-3 rounded shadow">
        {entityTypes?.map(et => (
          <label key={et.value} className="inline-flex items-center space-x-1">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-primary focus:ring-primary"
              checked={entityFilter.includes(et.value)}
              onChange={() => handleEntityFilterChange(et.value)}
            />
            <span className="text-sm text-gray-700">{et.label}</span>
          </label>
        ))}
      </div>}

      {/* Graph container */}
      <div className="flex-grow">
        <CytoscapeGraph nodes={filteredNodes} edges={filteredEdges} />
      </div>
    </div>
  );
};

export default DataFlowVisualise;
