import React, { useState } from 'react'
import { FiChevronDown, FiChevronRight, FiSearch, FiSettings, FiFilter, FiFolder } from 'react-icons/fi'
import { scanInventoryDTO, ScanService, startScanDTO } from '../../api/services/Scan/scan.api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../../redux/services/store'
import { resetJob, startJob } from '../../redux/services/ServerStatus/server.status.slice'
import { QueryKey } from '../../api/QueryKey'
import CommonButton from '../../components/buttons/CommonButton'
import EntityFilter from '../../components/filters/EntityFilter'
import { TbChartInfographic, TbGraph, TbNetwork } from 'react-icons/tb'
import { useNavigate } from 'react-router'
import FileSystemPage from '../filesystem/filesystem.page'
import CytoscapeGraph from '../../components/cytoscapegraph/CytoscapeGraph'
import DataFlowVisualise from '../graph/DataFlowVisualise'; // Import the DataFlowVisualise component

interface Finding {
    owasp_id: string
    severity: 'blocker' | 'high' | 'medium' | 'low'
    message: string
    location: string
    line: number
    fix: string
}

interface LLMUsage {
    tokens_used: number
    usd_used: number
    requests: number
    limits: {
        tokens: number
        usd: number
        requests: number
    }
}
const entityTypes = [
    { label: 'Code Module', value: 'CodeModule' },
    { label: 'LLM Call', value: 'LLMCall' },
    { label: 'LLM Model', value: 'LLMModel' },
    { label: 'Tool', value: 'Tool' },
    { label: 'API', value: 'API' },
    { label: 'Database', value: 'Database' },
    { label: 'Vector DB', value: 'VectorDB' },
    { label: 'File Access', value: 'File' },
    { label: 'Prompt', value: 'Prompt' },
];

const Inventory = () => {
    const navigate = useNavigate()

    const [expandedFiles, setExpandedFiles] = useState<string[]>([])
    const [severityFilter, setSeverityFilter] = useState<string[]>([])
    const [entityFilter, setEntityFilter] = useState<string[]>([]);
    const handleEntityFilterChange = (value: string) => {
        setEntityFilter((prev) =>
            prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
        );
    };

    const clearEntityFilters = () => {
        setEntityFilter([]);
    };
    const [searchQuery, setSearchQuery] = useState('')
    const [sortOrder, setSortOrder] = useState('a-z')
    const dispatch = useAppDispatch()
    const [scanPath, setScanPath] = useState<string>('');
    const { jobId: runId, isProcessing } = useAppSelector(state => state.serverStatus)
    const queryClient = useQueryClient()
    const [isFileSystemModalOpen, setIsFileSystemModalOpen] = useState<boolean>(false)
    const [fileSearchQuery, setFileSearchQuery] = useState<string>('')
    const [selectedScan, setSelectedScan] = useState<any>(null);
    const [isNetworkModalOpen, setIsNetworkModalOpen] = useState<boolean>(false);
    const [networkRecord, setNetworkRecord] = useState<any>(null);

    const [logLevel, setLogLevel] = useState<string>('info');
    const [scanDepth, setScanDepth] = useState<number>(1);

    const logLevels = ['debug', 'info', 'warn', 'error'];

    const handleFileSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFileSearchQuery(e.target.value)
    }

    const handleScanSelection = (record: any) => {
        handleNetworkView(record?.elements||null)
        // setSelectedScan(record?.elements || null);
    };

     // 1️⃣ Mutation to start a scan
     const { mutate: startScanInventory, isPending: isPendingStartInventoryServer } = useMutation({
        mutationFn: async (body:scanInventoryDTO ) => {
            const res = await ScanService.scanInventory(body)
            return res
        },
        onSuccess: (res, data) => {
            toast.success('Inventory scan starting!')
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: [QueryKey.JOB] })
            }, 2000)

            console.log(res, 'response after job started')
            if (res?.run_id) {
                dispatch(
                    startJob({
                        jobId: res?.run_id as any,
                        jobStatus: 'Starting',
                    }),
                )
            } else {
                dispatch(resetJob())
            }
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to create server.')
        },
    })

    console.log(runId)
    const {
        data: scans,
        isFetching: isFetchingScan,
    } = useQuery({
        queryKey: [QueryKey.JOB+'Inventory'],
        queryFn: async () => {
            const res = await ScanService.getResults(runId!!)

            if (res?.data) {
                dispatch(resetJob())
            }

            return res
        },
        initialData: [],
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        refetchInterval: isProcessing ? 3000 : false,
        enabled: !!runId,
    })

    // Derived state from query
    console.log(scans, 'inventory scans data')
    const llmUsage = scans?.llm_usage;
    const inventoryRecords = scans?.data?.records || [];

    const handleFolderSelection = (path:string) => {
        startScanInventory({
            path: path,
            logLevel:logLevel,
            depth: scanDepth,
        })

    }

    const toggleExpand = (filePath: string) => {
        setExpandedFiles((prev) =>
            prev.includes(filePath) ? prev.filter((path) => path !== filePath) : [...prev, filePath]
        )
    }

    const getSeverityChip = (label: string, count: number, color: string) => (
        <span className={`border ${color} text-${color} px-2 py-1 rounded-sm text-sm font-bold`}>
            {label} {count}
        </span>
    )

    const handleNetworkView = (record: any) => {
        setNetworkRecord(record);
        setIsNetworkModalOpen(true);
    };

    const closeNetworkModal = () => {
        setIsNetworkModalOpen(false);
        setNetworkRecord(null);
    };

    console.log(networkRecord,'network record')

    return (
        <div className="flex sm:ml-40">

            {/* Main Content */}
            <main className="flex-1 ">
                {/* Top Bar */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4 font-bold"> Scan Inventories With AI</div>
                    <div className="flex items-end space-x-4">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-2.5 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search files..."
                                className="pl-10 pr-4 py-2 border rounded w-64"
                                value={fileSearchQuery}
                                onChange={handleFileSearchChange}
                            />
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="flex flex-col items-start">
                                <label className="text-base font-medium text-gray-700">Log Level</label>
                                <select
                                    value={logLevel}
                                    onChange={(e) => setLogLevel(e.target.value)}
                                    className="bg-primary text-white px-4 py-2 rounded flex items-center"
                                    >
                                    {logLevels.map((level) => (
                                        <option key={level} value={level}>
                                            {level.charAt(0).toUpperCase() + level.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col items-start">
                                <label className="text-base font-medium text-gray-700">Scan Depth</label>
                                <input
                                    type="number"
                                    value={scanDepth}
                                    onChange={(e) => setScanDepth(Number(e.target.value))}
                                    min={1}
                                    className="bg-primary text-white px-4 py-2 rounded flex items-center"
                                />
                            </div>
                        </div>
                        <CommonButton
                            className="bg-primary text-white px-4 py-2 rounded flex items-center"
                            onClick={() => setIsFileSystemModalOpen(true)}
                            loading={isProcessing}
                        >
                            <FiFolder className="mr-2" />
                            Open File
                        </CommonButton>
                    </div>
                </div>

                {/* File System Modal */}
                {isFileSystemModalOpen && (
                    <div className="fixed inset-0  flex justify-center items-center z-50">
                        <div className=" w-3/4 h-3/4 rounded-lg shadow-lg overflow-hidden flex flex-col">
                        
                            <div className="flex-1 overflow-y-auto p-4">
                                <FileSystemPage setIsModalOpen={setIsFileSystemModalOpen} handleScan={handleFolderSelection} />
                            </div>
                        </div>
                    </div>
                )}

                {/* LLM Usage Summary */}
                {llmUsage && (
                    <div className="grid h-fit grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <div className="bg-card_bgLight rounded-lg border-2 border-neutral-100 p-4">
                            <h3 className="text-lg font-semibold text-gray-800">Tokens used</h3>
                            <p className="mt-2 text-3xl font-bold text-gray-900">
                                {llmUsage.tokens_used}
                            </p>
                        </div>
                        <div className="bg-card_bgLight rounded-lg border-2 border-neutral-100 p-4">
                            <h3 className="text-lg font-semibold text-gray-800">Total Cost</h3>
                            <p className="mt-2 text-3xl font-bold text-gray-900">${llmUsage.usd_used.toFixed(2)}</p>
                        </div>
                        <div className="bg-card_bgLight rounded-lg border-2 border-neutral-100 p-4">
                            <h3 className="text-lg font-semibold text-gray-800">LLM Requests</h3>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{llmUsage.requests}</p>
                        </div>
                    </div>
                )}

                {/* Inventory Records List */}
                <div>
                    {inventoryRecords.map((record: any, index: number) => (
                        <div key={index} className={`border-b py-4 px-1 ${networkRecord?.at === record?.at ? 'bg-amber-200' : ''}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <span className="font-bold">{record.sink}</span>
                                    <span className="text-sm text-gray-500">{record.at}</span>
                                </div>
                                <div className="flex space-x-4">
                                    <button
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-md transition duration-200"
                                        onClick={() => handleNetworkView(record)}
                                    >
                                        View Graph
                                    </button>
                                    <a
                                        href={`vscode://file/${record.sink}`}
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-md transition duration-200 flex items-center"
                                    >
                                        Edit File
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {inventoryRecords.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <FiFolder size={48} className="mb-4" />
                        <p className="text-lg font-semibold">No inventory records available</p>
                        <p className="text-sm mt-2">Add a repository to start scanning for inventory data.</p>
                    </div>
                )}

                {/* Network Visualization Modal */}
                {isNetworkModalOpen && (
                    <div className="fixed inset-0  bg-opacity-0 flex justify-end items-center z-50">
                        <div className="bg-white w-2/4 h-full shadow-lg overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center p-4 border-b">
                                <h2 className="text-lg font-semibold">Data Flow Visualization</h2>
                                <button
                                    className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded flex items-center"
                                    onClick={closeNetworkModal}
                                >
                                    Close
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {networkRecord && <DataFlowVisualise records={networkRecord} />}
                            </div>
                        </div>
                    </div>
                )}

                {/* Visualization Section */}
                {selectedScan && (
                    <div className="mt-8">
                        <h2 className="text-xl font-semibold mb-4">Data Flow Visualization</h2>
                        <CytoscapeGraph
                            nodes={selectedScan.nodes}
                            edges={selectedScan.edges}
                        />
                    </div>
                )}
            </main>
        </div>
    )
}

export default Inventory
