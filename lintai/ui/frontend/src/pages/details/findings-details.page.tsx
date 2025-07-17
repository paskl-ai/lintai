import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';





const StatCard = ({ label, value, mainStyle = false }) => (
    <div className={`p-4 border rounded-lg ${mainStyle ? 'border-primary bg-blue-50' : 'border-gray-200 bg-white'}`}>
        <p className={`text-sm ${mainStyle ? 'text-blue-700' : 'text-gray-500'}`}>{label}</p>
        <p className={`text-2xl font-bold ${mainStyle ? 'text-primary' : 'text-gray-800'}`}>{value}</p>
    </div>
);

const SeverityDot = ({ severity }) => {
    const colorClass = {
        critical: 'bg-purple-500',
        blocker: 'bg-red-500',
        high: 'bg-orange-500',
        medium: 'bg-yellow-400',
        low: 'bg-primary',
    }[severity] || 'bg-gray-400';

    return <div className={`w-3 h-3 rounded-full ${colorClass}`}></div>;
};






const FiChevronLeft = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>;
const FiSearch = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;

// ------------------------------------------------------------------
// Main Details Page Component
// ------------------------------------------------------------------
const FindingsDetailsPage = () => {
    // In a real app, you'd get the file path from the URL params
    const filePath = "examples/pii_leak.py"; 
    const navigate = useNavigate();

    const {state} = useLocation();
const findings = state || []; // Assuming findings are passed via state
console.log('Findings:', state);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRows, setSelectedRows] = useState([]);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedRows(findings.map(f => f.line)); // assuming line is unique for demo
        } else {
            setSelectedRows([]);
        }
    }

    const handleSelectRow = (line) => {
        setSelectedRows(prev => 
            prev.includes(line) 
                ? prev.filter(l => l !== line)
                : [...prev, line]
        );
    }

    const stats = useMemo(() => {
        return {
            total: findings.length,
            blocker: findings.filter(f => f.severity === 'blocker' || f.severity === 'critical').length,
            owasp: findings.filter(f => f.owasp_id).length,
            mitre: findings.filter(f => f.mitre_id).length,
        }
    }, [findings]);

    const filteredFindings = useMemo(() => {
        return findings.filter(f => 
            f.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.owasp_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.fix.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [findings, searchQuery]);

    return (
    <div className=" sm:ml-50 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="mb-6">
            <div className="flex items-center gap-2">

            <span className="cursor-pointer" onClick={() => navigate(-1)}>
            <FiChevronLeft />
            </span>
            <h1 className="text-3xl font-bold text-gray-800">
                    <span className="font-normal text-gray-500">Findings / </span> 
                    {filePath}
                </h1>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Findings" value={stats.total} mainStyle />
                <StatCard label="Blocker" value={stats.blocker} />
                <StatCard label="Findings with OWASP" value={stats.owasp} />
                <StatCard label="Findings with Mitre" value={stats.mitre} />
            </div>

            {/* Controls and Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <div className="relative w-full max-w-xs">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text"
                            placeholder="Search here..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {/* <button className="text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-100">Actions</button> */}
                        <button className="text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-100">Configuration</button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-gray-600">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <tr>
                                <th scope="col" className="p-4 w-4"><input type="checkbox" onChange={handleSelectAll} /></th>
                                <th scope="col" className="px-6 py-3">Finding Title</th>
                                <th scope="col" className="px-6 py-3">Severity</th>
                                <th scope="col" className="px-6 py-3">Line No.</th>
                                <th scope="col" className="px-6 py-3">Fix</th>
                            </tr>
                        </thead>
                        <tbody>
                            { filteredFindings.map((finding, index) => (
                                <tr key={index} className="bg-white border-b hover:bg-gray-50">
                                    <td className="p-4"><input type="checkbox" checked={selectedRows.includes(finding.line)} onChange={() => handleSelectRow(finding.line)} /></td>
                                    <td className="px-6 py-4 font-medium text-gray-800">{finding.owasp_id}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <SeverityDot severity={finding.severity} />
                                            <span className="capitalize">{finding.severity}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{finding.line}</td>
                                    <td className="px-6 py-4 text-gray-500">{finding.fix}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
             
                </div>
                 {/* Pagination */}
                <div className="p-4 flex justify-between items-center text-sm text-gray-600">
                    <div>
                        <span>Results per page </span>
                        <select className="border border-gray-300 rounded-md p-1">
                            <option>20</option>
                            <option>50</option>
                        </select>
                    </div>
                    <div>1-{filteredFindings.length} of {findings.length} results</div>
                    <div className="flex gap-2">
                        <button className="p-1 border rounded-md hover:bg-gray-100">&lt;</button>
                        <button className="p-1 border rounded-md hover:bg-gray-100">&gt;</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FindingsDetailsPage;
