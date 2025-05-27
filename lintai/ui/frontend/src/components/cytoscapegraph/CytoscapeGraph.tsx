// filepath: /components/CytoscapeGraph.tsx
import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

interface CytoscapeGraphProps {
    nodes: any[];
    edges: any[];
}

const CytoscapeGraph: React.FC<CytoscapeGraphProps> = ({ nodes, edges }) => {
    const cyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (cyRef.current) {
            cytoscape({
                container: cyRef.current,
                elements: [...nodes, ...edges],
                style: [
                    {
                        selector: 'node',
                        style: {
                            'background-color': '#0074D9',
                            'label': 'data(label)',
                            'color': '#fff',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'font-size': '10px',
                            'width': '40px',
                            'height': '40px',
                        },
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 2,
                            'line-color': '#ccc',
                            'target-arrow-color': '#ccc',
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier',
                            'label': 'data(label)',
                            'font-size': '8px',
                            'text-background-color': '#fff',
                            'text-background-opacity': 1,
                            'text-background-padding': '2px',
                        },
                    },
                ],
                layout: {
                    name: 'cose', // You can use other layouts like 'grid', 'circle', etc.
                    fit: true,
                },
            });
        }
    }, [nodes, edges]);

    return <div ref={cyRef} style={{ width: '100%', height: '100%' }} />;
};

export default CytoscapeGraph;