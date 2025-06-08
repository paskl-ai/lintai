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
import ConfigurationInfo from '../../components/configurationInfo/ConfigurationInfo'

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
        setSearchQuery(e.target.value)
    }

    const configValues = useAppSelector((state) => state.config); // Access config slice

    const handleNavigateToConfig = () => {
        navigate('/configuration'); // Adjust route as needed
    };

    const handleScanSelection = (record: any) => {
        handleNetworkView(record?.elements || null)
        // setSelectedScan(record?.elements || null);
    };

    // 1️⃣ Mutation to start a scan
    const { mutate: startScanInventory, isPending: isPendingStartInventoryServer } = useMutation({
        mutationFn: async (body: scanInventoryDTO) => {
            const res = await ScanService.scanInventory(body)
            return res
        },
        onSuccess: (res, data) => {
            // toast.success('Inventory scan starting!')
            toast.loading(`Scanning path: ${data?.path || configValues?.config?.sourcePath}`)

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
                toast.dismiss()
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
        queryKey: [QueryKey.JOB + 'inventory'],
        queryFn: async () => {
            const res = await ScanService.getResults(runId!!)

            if (res?.data) {
                dispatch(resetJob())
                toast.dismiss()

            }

            return res
        },
        initialData: [],
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        refetchInterval: isProcessing ? 3000 : false,
        enabled: !!runId,
    })

    const {
        data: lastscan,
        isFetching: isFetchingLastScan,
    } = useQuery({
        queryKey: [QueryKey.JOB + 'last'],
        queryFn: async () => {
            const res = await ScanService.getLastResults()



            return res?.report
        },
        initialData: [],
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        refetchInterval: isProcessing ? 3000 : false,
        enabled: !!(!scans?.data?.records)
    })
    // Derived state from query
    console.log(scans, 'inventory scans data')
    const llmUsage = scans?.llm_usage || lastscan?.llm_usage;
    const inventoryRecords = scans?.data?.records || lastscan?.data?.records || [];

    // Filter inventory records based on the search query
    const filteredInventoryRecords = inventoryRecords.filter((record: any) => {
        const searchLower = searchQuery.toLowerCase()
        return (
            record.sink.toLowerCase().includes(searchLower) ||
            record.at.toLowerCase().includes(searchLower)
        )
    })

    const handleFolderSelection = (path: string) => {
        startScanInventory({
            path: path,
            logLevel: logLevel,
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

    console.log(networkRecord, 'network record')

    return (
        <div className="p-6 flex sm:ml-50">

            {/* Main Content */}
            <main className="flex-1 ">
                {/* Top Bar */}
                <div className="flex flex-row items-center justify-between mb-6">
                        <div>
                            <h3 className="font-bold  text-gray-700">Scan Inventory</h3>

                        </div>
                        <div className="flex items-center gap-2">
                        {/* Configuration Section */}
                <ConfigurationInfo/>
                            <div className="relative">
                                <FiSearch className="absolute left-3 top-2.5 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search files..."
                                    className="pl-10 pr-4 py-2 border rounded w-64"
                                    value={searchQuery}
                                    onChange={handleFileSearchChange}
                                />
                            </div>

                            <CommonButton
                                className=" bg-primary text-white px-4 py-2 rounded flex w-full items-center"
                                onClick={() => setIsFileSystemModalOpen(true)}
                                loading={isProcessing}
                            >
                                <FiFolder className="mr-2" />
                                Run scan
                            </CommonButton>
                        </div>
                    </div>
             

                {/* File System Modal */}
                {isFileSystemModalOpen && (
                    <div className="fixed inset-0  flex justify-center items-center z-50">
                        <div className=" w-3/4 h-3/4 rounded-lg shadow-lg overflow-hidden flex flex-col">

                            <div className="flex-1 overflow-y-auto p-4">
                                <FileSystemPage startLocation={configValues?.config?.sourcePath} setIsModalOpen={setIsFileSystemModalOpen} handleScan={handleFolderSelection} />
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
                    {filteredInventoryRecords.map((record: any, index: number) => (
                        <div key={index} className={`border-b py-4 px-1 ${networkRecord?.at === record?.at ? 'bg-amber-200' : ''}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <span className="font-bold">{record.sink}</span>
                                    <span className="text-sm">
                                        <span className="text-red-800">{record.at.split(':')[0]}</span>
                                        <span className="text-blue-800">:</span>
                                        <span className="text-green-600 font-bold" >{record.at.split(':')[1]}</span>
                                    </span>
                                </div>
                                <div className="flex space-x-4">
                                    <button
                                        className="border-1 border-blue-500 hover:bg-blue-500  px-4 py-2 rounded-md  transition duration-200 flex items-center"
                                        onClick={() => handleNetworkView(record)}
                                    >
                                        <p>View</p>
                                        <TbGraph />
                                    </button>
                                    <a
                                        href={`vscode://file/${record.at}`}
                                        className="border-1 border-green-500 hover:bg-green-500  px-4 py-2 rounded-md  transition duration-200 flex items-center"
                                    >
                                        Edit
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {filteredInventoryRecords.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <FiFolder size={48} className="mb-4" />
                        <p className="text-lg font-semibold">No matching inventory records found</p>
                        <p className="text-sm mt-2">Try adjusting your search query.</p>
                    </div>
                )}

                {/* Network Visualization Modal */}
                {isNetworkModalOpen && (
                    <div

                        className="fixed inset-0  bg-opacity-0 flex justify-end items-center z-50   transition duration-300 ease-in-out slide-in-from-right">
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
