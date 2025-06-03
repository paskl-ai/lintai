import React, { useState } from 'react'
import { FiChevronDown, FiChevronRight, FiSearch,FiFolder } from 'react-icons/fi'
import { scanInventoryDTO, ScanService, startScanDTO } from '../../api/services/Scan/scan.api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { useAppDispatch, useAppSelector } from '../../redux/services/store'
import { resetJob, startJob } from '../../redux/services/ServerStatus/server.status.slice'
import { QueryKey } from '../../api/QueryKey'
import CommonButton from '../../components/buttons/CommonButton'
import { useNavigate } from 'react-router'
import FileSystemPage from '../filesystem/filesystem.page'

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

const Dashboard = () => {
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

    const handleFileSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFileSearchQuery(e.target.value)
    }

    const configValues = useAppSelector((state) => state.config); // Access config slice

    const handleNavigateToConfig = () => {
        navigate('/configuration'); // Adjust route as needed
    };

    // 1️⃣ Mutation to start a scan
    const { mutate: startScan, isPending: isPendingStartServer } = useMutation({
        mutationFn: async (body:startScanDTO ) => {
            const res = await ScanService.startScan(body)
            return res
        },
        onSuccess: (res, data) => {
            // toast.success('Scan starting!')
            toast.loading(`Scanning path: ${data?.path||configValues?.config?.sourcePath}`)

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
            toast.error(error.message || 'Failed to scan path.')
        },
    })


    // console.log(runId)
    const {
        data: scans,
        isFetching: isFetchingScan,
    } = useQuery({
        queryKey: [QueryKey.JOB],
        queryFn: async () => {
            const res = await ScanService.getResults(runId!!)

            if (res?.data||res?.findings) {
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
        queryKey: [QueryKey.JOB+'last'],
        queryFn: async () => {
            const res = await ScanService.getLastResults()

            if (res?.data||res?.findings) {
                dispatch(resetJob())
                toast.dismiss()

            }

            return res.report
        },
        initialData: [],
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        refetchInterval: isProcessing ? 3000 : false,
        enabled: !!(!scans?.findings)
    })

    // Derived state from query
    const llmUsage = scans?.llm_usage||lastscan?.llm_usage;
    const findings: Finding[] = (scans?.findings||lastscan?.findings as Finding[]) ?? [];

    const handleFolderSelection = (path:string) => {
        // const input = document.createElement('input')
        // input.type = 'file'
        //     ; (input as any).webkitdirectory = true
        // input.multiple = true

        // input.onchange = (e) => {
        //     console.log(e.target.files, 'selected files')

        //     const files = Array.from((e.target as HTMLInputElement).files || [])

        //     if (!files.length) return

        //     const rel = files[0].webkitRelativePath
        //     const segments = rel.split('/')
        //     segments.pop()
        //     const folderRel = segments.join('/')

        //     const form = new FormData();
        //     files.forEach(f => form.append("files", f));
        //     form.append("path", "my/src");
        //     form.append("depth", "2");
        //     form.append("log_level", "DEBUG");

        //     setScanPath(folderRel)
        //     startScan(form)
        // }

        // input.click()
        // console.log(path, 'selected path')
const body={
    path: path
}
        startScan(body)

    }

    const toggleExpand = (filePath: string) => {
        setExpandedFiles((prev) =>
            prev.includes(filePath) ? prev.filter((path) => path !== filePath) : [...prev, filePath]
        )
    }

    const filteredFindings = findings.filter((finding: Finding) => {
        const matchesSeverity = severityFilter.length === 0 || severityFilter.includes(finding.severity)
        const matchesSearch =
            finding.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
            finding.owasp_id.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesSeverity && matchesSearch
    })

    const groupedFindings = filteredFindings?.reduce((acc: { [x: string]: Finding[] }, finding: Finding) => {
        if (!acc[finding.location]) acc[finding.location] = []
        acc[finding.location].push(finding)
        return acc
    }, {} as Record<string, Finding[]>)

    const getSeverityChip = (label: string, count: number, color: string) => (
        <span className={`border ${color} text-${color} px-2 py-1 rounded-sm text-sm font-bold`}>
            {label} {count}
        </span>
    )

   console.log(configValues?.config?.sourcePath,'startLocation')

    return (
        <div className="flex sm:ml-50">
            {/* Sidebar filters */}
            {/* <aside className="w-50 bg-white p-6 border-r h-screen">
                <h2 className="text-xl font-semibold mb-6 text-gray-800">Filters</h2>
             
             
            </aside> */}

            {/* Main Content */}
            <main className="flex-1 p-6">
                {/* Top Bar */}
                <div className="flex items-center justify-between mb-6">
                <div className="flex flex-row gap-2 items-center justify-between ">
                    <h3 className="font-bold  text-gray-700">Severity</h3>
                    <div className="flex items-end space-x-4">

                    {['blocker', 'high', 'medium', 'low'].map((severity) => (
                        <div key={severity} className="flex items-center justify-between ">
                            <button
                                className={`px-4 py-2 rounded flex items-center border ${
                                    severityFilter.includes(severity)
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-white text-primary border-primary'
                                }`}
                                onClick={() =>
                                    setSeverityFilter((prev) =>
                                        prev.includes(severity)
                                            ? prev.filter((s) => s !== severity)
                                            : [...prev, severity]
                                    )
                                }
                            >
                                {severity.charAt(0).toUpperCase() + severity.slice(1)}
                            </button>
                        </div>
                    ))}
                    </div>
                </div>
                    <div className="flex items-center space-x-4">
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
                        <CommonButton
                            className="bg-primary text-white px-4 py-2 rounded flex items-center"
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
                        <div className="w-3/4 h-3/4 rounded-lg shadow-lg overflow-hidden flex flex-col">
                        
                            <div className="flex-1 overflow-y-auto p-4">
                                <FileSystemPage startLocation={configValues?.config?.sourcePath} setIsModalOpen={setIsFileSystemModalOpen} handleScan={(e)=>handleFolderSelection(e)} />
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

                {/* Configuration Section */}
                <div 
                    className="bg-card_bgLight rounded-lg border-2 border-neutral-100 p-4 mt-6 cursor-pointer"
                    onClick={handleNavigateToConfig}
                >
                    <h3 className="text-lg font-semibold text-gray-800">Configuration</h3>
                    <pre className="mt-2 text-sm text-gray-700">
                        {JSON.stringify(configValues, null, 2)}
                    </pre>
                </div>

                {/* Findings List */}
                <div>
                    {Object.entries(groupedFindings).map(([location, findings]) => (
                        <div key={location} className="border-b py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <button onClick={() => toggleExpand(location)}>
                                        {expandedFiles.includes(location) ? (
                                            <FiChevronDown className="text-gray-500" />
                                        ) : (
                                            <FiChevronRight className="text-gray-500" />
                                        )}
                                    </button>
                                    <span className="font-bold">{location}</span>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className="flex space-x-2">
                                        {getSeverityChip(
                                            'B',
                                            findings.filter((f) => f.severity === 'blocker').length,
                                            'border-2 border-red-600 text-black'
                                        )}
                                        {getSeverityChip(
                                            'H',
                                            findings.filter((f) => f.severity === 'high').length,
                                            'border-2 border-orange-500 text-black'
                                        )}
                                        {getSeverityChip(
                                            'M',
                                            findings.filter((f) => f.severity === 'medium').length,
                                            'border-2 border-yellow-400 text-black'
                                        )}
                                        {getSeverityChip(
                                            'L',
                                            findings.filter((f) => f.severity === 'low').length,
                                            'border-2 border-green-500 text-black'
                                        )}
                                    </div>
                                    <button className="text-blue-500 text-sm">View Report</button>
                                    {/* <TbNetwork className="text-primary0" size={30} onClick={handleNetworkView} /> */}
                                </div>
                            </div>
                            {expandedFiles.includes(location) && (
                                <div className="ml-8 mt-4">
                                    {findings.map((finding, index) => (
                                        <div key={index} className={`flex items-center ${index > 0 ? "border-t border-gray-300" : ""} justify-between py-2`}>
                                            <div className="flex items-center space-x-4">
                                                <span className="text-sm">{finding.owasp_id}</span>
                                                <span
                                                    className={`px-2 py-1 rounded-sm text-sm ${finding.severity === 'blocker'
                                                            ? 'bg-red-600 text-white'
                                                            : finding.severity === 'high'
                                                                ? 'bg-orange-500 text-white'
                                                                : finding.severity === 'medium'
                                                                    ? 'bg-yellow-400 text-black'
                                                                    : 'bg-green-500 text-white'
                                                        }`}
                                                >
                                                    {finding.severity}
                                                </span>
                                                <span className="text-sm">{finding.message}</span>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <span className="text-sm text-gray-500">
                                                    <span className="font-bold">Line:</span> {finding.line}
                                                </span>
                                                <span
                                                    className={`text-sm px-2 py-1 rounded-sm ${finding.severity === 'blocker'
                                                            ? 'bg-red-100 text-red-800'
                                                            : finding.severity === 'high'
                                                                ? 'bg-orange-100 text-orange-800'
                                                                : finding.severity === 'medium'
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : 'bg-green-100 text-green-800'
                                                        }`}
                                                >
                                                    {finding.fix}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {findings.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <FiFolder size={48} className="mb-4" />
                        <p className="text-lg font-semibold">No findings available</p>
                        <p className="text-sm mt-2">Add a repository to start scanning for issues.</p>
                    </div>
                )}
            </main>
        </div>
    )
}

export default Dashboard
