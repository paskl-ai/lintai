import React from 'react';
import CytoscapeGraph from '../../components/cytoscapegraph/CytoscapeGraph';
const nodes = [
    { data: { id: '1', label: 'agent_core.py', type: 'CodeModule' } },
    { data: { id: '2', label: 'OpenAI API Call', type: 'LLMCall' } },
    { data: { id: '3', label: 'gpt-4-turbo', type: 'LLMModel' } },
    { data: { id: '4', label: 'search_tool.py', type: 'CodeModule' } },
    { data: { id: '5', label: 'Web Search Tool', type: 'Tool' } },
    { data: { id: '6', label: 'Google Search API', type: 'API' } },
    { data: { id: '7', label: 'vector_db_manager.py', type: 'CodeModule' } },
    { data: { id: '8', label: 'Pinecone Index', type: 'VectorDB' } },
    { data: { id: '9', label: 'Summarization Prompt', type: 'Prompt' } },
    { data: { id: '10', label: 'config.yaml', type: 'File' } },
];

const edges = [
    { data: { source: '1', target: '2', label: 'invokes' } },
    { data: { source: '2', target: '3', label: 'uses model' } },
    { data: { source: '2', target: '9', label: 'uses prompt' } },
    { data: { source: '1', target: '5', label: 'uses tool' } },
    { data: { source: '4', target: '5', label: 'defines tool' } },
    { data: { source: '5', target: '6', label: 'calls api' } },
    { data: { source: '1', target: '8', label: 'interacts with' } },
    { data: { source: '7', target: '8', label: 'manages' } },
    { data: { source: '1', target: '10', label: 'reads config' } },
];

const DataFlowVisualise = () => {
    return (
        <div className="flex  sm:ml-40 fill h-screen w-full flex-col items-center justify-center p-4">
            <CytoscapeGraph nodes={nodes} edges={edges}  />
        </div>
    );
};

export default DataFlowVisualise;
