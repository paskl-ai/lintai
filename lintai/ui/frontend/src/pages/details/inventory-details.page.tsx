import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import DataFlowVisualise from '../graph/DataFlowVisualise';
import { FiChevronLeft, FiSearch } from 'react-icons/fi';

interface Component {
    component_type: string;
    name: string;
    location: string;
    code_snippet: string;
    call_chain: string[];
    relationships: Relationship[];
}

interface Relationship {
    target_name: string;
    type: string;
}

interface InventoryItem {
    name: string;
    path: string;
    type: string;
    frameworks: string[];
    components: Component[];
    date: string;
}

const InventoryDetailsPage = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const inventory: InventoryItem = state;

    const [searchQuery, setSearchQuery] = useState('');

    // Transform components data for visualization
    const graphData = useMemo(() => {
        if (!inventory?.components) return { nodes: [], edges: [] };

        const nodes = new Map();
        const edges = new Map();

        // Add file node as parent container
        const fileId = inventory.path;
        nodes.set(fileId, {
            data: {
                id: fileId,
                label: 'file',
                name: inventory.name,
                type: 'file',
            },
        });

        // First, add all components from the inventory
        inventory.components.forEach((comp) => {
            const componentId = comp.name;
            const isInternal = comp.location && comp.location.startsWith(inventory.path);
            
            nodes.set(componentId, {
                data: {
                    id: componentId,
                    label: comp.component_type.toLowerCase(),
                    name: comp.name,
                    type: comp.component_type.toLowerCase(),
                    parent: isInternal ? fileId : undefined, // Make it a child of the file if internal
                    location: comp.location,
                    code_snippet: comp.code_snippet,
                },
            });
        });

        // Then, process all relationships and create nodes for targets that don't exist
        inventory.components.forEach((comp) => {
            comp.relationships.forEach((rel) => {
                const targetId = rel.target_name;
                
                // Create target node if it doesn't exist
                if (!nodes.has(targetId)) {
                    // Try to infer the component type from the target name
                    let inferredType = 'external';
                    if (targetId.includes('Agent')) inferredType = 'agent';
                    else if (targetId.includes('Tool')) inferredType = 'tool';
                    else if (targetId.includes('Chat')) inferredType = 'chain';
                    else if (targetId.includes('Client')) inferredType = 'tool';
                    else if (targetId.includes('Console')) inferredType = 'ui';
                    else if (targetId.includes('close')) inferredType = 'lifecycle';
                    else if (targetId.includes('run')) inferredType = 'chain';
                    
                    nodes.set(targetId, {
                        data: {
                            id: targetId,
                            label: inferredType,
                            name: targetId,
                            type: inferredType,
                            // External nodes are not children of the file
                        },
                    });
                }

                // Create edge
                const edgeId = `${comp.name}-${targetId}`;
                edges.set(edgeId, {
                    data: {
                        id: edgeId,
                        source: comp.name,
                        target: targetId,
                        label: rel.type,
                        type: rel.type,
                    },
                });
            });
        });

        const result = {
            nodes: Array.from(nodes.values()),
            edges: Array.from(edges.values()),
        };

        console.log('Graph data generated:', result);
        console.log('Total nodes:', result.nodes.length);
        console.log('Total edges:', result.edges.length);

        return result;
    }, [inventory]);

    // Filter components based on search
    const filteredComponents = useMemo(() => {
        if (!inventory?.components) return [];
        return inventory.components.filter(
            (comp) =>
                comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                comp.component_type.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [inventory, searchQuery]);

    return (
        <div className="bg-gray-50 min-h-screen p-6 sm:ml-50">
            <header className="mb-6">
                <div className="flex items-center gap-2">
                    <span className="cursor-pointer" onClick={() => navigate(-1)}>
                        <FiChevronLeft />
                    </span>
                    <h1 className="text-3xl font-bold text-gray-800">
                        {inventory.path || 'Details'}
                    </h1>
                </div>
                <div className="mt-2 flex gap-4">
                    <span className="text-sm text-gray-600">
                        Frameworks:{' '}
                        {inventory.frameworks?.length
                            ? inventory.frameworks.join(', ')
                            : 'None'}
                    </span>
                    <span className="text-sm text-gray-600">
                        Components: {inventory.components?.length || 0}
                    </span>
                </div>
            </header>

            {/* Graph Visualization */}
            <div
                className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-6"
                style={{ height: '450px' }}
            >
                <DataFlowVisualise elements={graphData} />
            </div>

            {/* Components Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search components..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-gray-600">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <tr>
                                <th className="px-6 py-3">Component Name</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Location</th>
                                <th className="px-6 py-3">Dependencies</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredComponents.map((comp, index) => (
                                <tr
                                    key={index}
                                    className="border-b hover:bg-gray-50"
                                >
                                    <td className="px-6 py-4 font-medium">
                                        {comp.name}
                                    </td>
                                    <td className="px-6 py-4">
                                        {comp.component_type}
                                    </td>
                                    <td className="px-6 py-4">
                                        {comp.location}
                                    </td>
                                    <td className="px-6 py-4">
                                        {comp.relationships.length}{' '}
                                        relationships
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredComponents.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <p>No components found.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InventoryDetailsPage;
