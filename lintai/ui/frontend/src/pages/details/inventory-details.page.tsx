import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router';
import DataFlowVisualise from '../graph/DataFlowVisualise';

// ------------------------------------------------------------------
// MOCK DATA & SERVICES (to make the component self-contained)
// ------------------------------------------------------------------



const FiChevronLeft = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>;
const FiCode = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>;
const FiDatabase = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>;
const FiFile = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>;
const FiGlobe = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;
const FiCpu = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>;
const FiSearch = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
const FiChevronDown = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>;



// ------------------------------------------------------------------
// Main Inventory Details Page Component
// ------------------------------------------------------------------
const InventoryDetailsPage = () => {
const navigate= useNavigate()
    const {state} = useLocation();
const inventory = state || []; // Assuming findings are passed via state
console.log('Inventory:', inventory);


const { name, records, path} = inventory;

    const [activeTab, setActiveTab] = useState('sinks');
    const [searchQuery, setSearchQuery] = useState('');

    const graphData =  { nodes:inventory.nodes, edges: inventory.edges};

    const filteredRecords = useMemo(() => {
        return records.filter(rec => 
            rec.sink.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rec.at.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [records, searchQuery]);
  
    const aggregatedElements = useMemo(() => {
        if (!records || records.length === 0) return { nodes: [], edges: [] };
        const nodeMap = new Map();
        const edgeSet = new Set();
        
        nodeMap.set(name, { data: { id: name, name, label: 'file' } });
        
        records.forEach(rec => {
            rec.elements?.nodes?.forEach(node => {
                if (!nodeMap.has(node.data.id)) {
                    // Enrich node with file info if it's from another file
                    const nodeId = node.data.id;
                    const nodeFile = nodeId.split('.')[0] + ".py";
                    if(nodeId.includes('.') && name !== nodeFile) {
                       node.data.name = `${node.data.name}\n(${nodeFile})`;
                       node.data.label = 'external_file';
                    }
                    nodeMap.set(node.data.id, node);
                }
            });
            rec.elements?.edges?.forEach(edge => edgeSet.add(JSON.stringify(edge)));
        });
        
        return {
            nodes: Array.from(nodeMap.values()),
            edges: Array.from(edgeSet).map(e => JSON.parse(e))
        };
    }, [records, name]);
    const displayRecords = useMemo(() => {
        if (!filteredRecords) return [];
        const isSink = r => r.type !== 'Component';
        const isComponent = r => r.type === 'Component';

        if (activeTab === 'sinks') return filteredRecords.filter(isSink);
        if (activeTab === 'components') return filteredRecords.filter(isComponent);
        return [];
    }, [filteredRecords, activeTab]);
    return (
        <div className="bg-gray-50 min-h-screen p-6 sm:ml-50" >
            <header className="mb-6">
                
                 <div className="flex items-center gap-2 text-center">
                 <span className="font-normal text-gray-500" onClick={() => navigate(-1)} style={{ cursor: 'pointer' }}> 
                 
                 <FiChevronLeft  />
           </span> 
                    <p className="text-3xl font-bold text-gray-800">
                   
                        {path || 'Details'}
                    </p>
                    <FiChevronDown className="text-gray-500 mt-2" />
                </div>
            </header>

            {/* Graph Visualization */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm" style={{ height: '450px' }}>
                <DataFlowVisualise elements={aggregatedElements} />
            </div>

            {/* Sinks & Components Table */}
            <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <div className="flex">
                        <button onClick={() => setActiveTab('sinks')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'sinks' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Sinks</button>
                        <button onClick={() => setActiveTab('components')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'components' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Components</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" placeholder="Search here..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                   className="pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                        <button className="text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-100">Actions</button>
                        <button className="text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-100">Configuration</button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-gray-600">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <tr>
                                <th scope="col" className="p-4 w-4"><input type="checkbox" /></th>
                                <th scope="col" className="px-6 py-3">Title</th>
                                <th scope="col" className="px-6 py-3">Line No.</th>
                                <th scope="col" className="px-6 py-3">Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayRecords.map((record, index) => (
                                <tr key={index} className="bg-white border-b hover:bg-gray-50">
                                    <td className="p-4"><input type="checkbox" /></td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{record.sink}</td>
                                    <td className="px-6 py-4">{record.at.split(':')[1]}</td>
                                    <td className="px-6 py-4">{record.type}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {displayRecords.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <p>No records to display for this category.</p>
                        </div>
                    )}
                </div>

                 <div className="p-4 flex justify-between items-center text-sm text-gray-600">
                    <div>
                        <span>Results per page </span>
                        <select className="border border-gray-300 rounded-md p-1 ml-1">
                            <option>20</option><option>50</option>
                        </select>
                    </div>
                    <div>1-{displayRecords.length} of {displayRecords.length} results</div>
                    <div className="flex gap-2">
                        <button className="p-2 border rounded-md hover:bg-gray-100 disabled:opacity-50" disabled>&lt;</button>
                        <button className="p-2 border rounded-md hover:bg-gray-100 disabled:opacity-50" disabled>&gt;</button>
                    </div>
                </div>
            </div>
        </div>
    );
};



export default InventoryDetailsPage;
