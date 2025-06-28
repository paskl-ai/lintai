/* ---------------------------------------------------------------------
 *  Scan.page.tsx
 *  Completely refactored to use the <Table /> component (shared with
 *  server‑list) instead of the old “Sonar” accordion layout.
 * ------------------------------------------------------------------- */

import React, { useEffect, useMemo, useState } from 'react'
import { FiSearch, FiFolder } from 'react-icons/fi'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router'

import {
  scanInventoryDTO,
  ScanService,
  startScanDTO,
} from '../../api/services/Scan/scan.api'
import CommonButton from '../../components/buttons/CommonButton'
import ConfigurationInfo from '../../components/configurationInfo/ConfigurationInfo'
import FileSystemPage from '../filesystem/filesystem.page'
import Table from '../../components/table/Table'

import { QueryKey } from '../../api/QueryKey'
import {
  resetJob,
  startJob,
} from '../../redux/services/ServerStatus/server.status.slice'
import { useAppDispatch, useAppSelector } from '../../redux/services/store'
import { StatCard } from '../../components/stateCard/StateCard'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

const FiFolder = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>;
const FiFileText = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
const FiChevronDown = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>;
const FiChevronRight = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>;
const FiAlertTriangle = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
const FiShield = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>;
const FiSearch = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
const FiEye = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
const FiEdit = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;

type Severity = 'critical' | 'blocker' | 'high' | 'medium' | 'low'



interface Finding {
  owasp_id: string
  severity: Severity
  message: string
  location: string
  line: number
  fix: string
  detector_id: string
}

interface GroupedFinding {
  type: 'folder' | 'file'
  name: string
  path: string
  children?: GroupedFinding[]
  findings?: Finding[]
}

interface LLMUsage {
  tokens_used: number
  usd_used: number
  requests: number
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
const FindingsSkeleton = () => (
  <div className="space-y-2 p-4">
      {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-md border border-gray-200">
              <div className="h-4 bg-gray-300 rounded w-3/4 animate-pulse"></div>
              <div className="h-3 bg-gray-300 rounded w-1/2 mt-2 animate-pulse"></div>
          </div>
      ))}
  </div>
);



const FindingRow = ({
  item,
  level = 0,
}: {
  item: GroupedFinding
  level?: number
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const navigate = useNavigate();

  const handleEditClick = (e, path) => {
      e.stopPropagation();
      window.location.href = `vscode://file/${path}`;
  }

  const handleViewClick = (e, path) => {
      navigate(`details/${encodeURIComponent(path)}`, { state: e });
  }

  if (item.type === 'folder') {
    return (
      <div className="bg-white">
        <div
          className="flex items-center p-2 cursor-pointer hover:bg-gray-100 border-b border-gray-200"
          style={{ paddingLeft: `${level * 24 + 16}px` }}
          onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? (
            <FiChevronDown className="mr-2 text-gray-500" />
          ) : (
            <FiChevronRight className="mr-2 text-gray-500" />
          )}
          <FiFolder className="mr-2 text-blue-500" />
          <span className="font-medium text-gray-800">{item.name}</span>
          <span className="ml-2 text-sm text-gray-500">({item.children?.length || 0} files)</span>
        </div>
        {isExpanded && item.children?.map((child) => (
          <FindingRow
            key={child.path}
            item={child}
            level={level + 1}
          />
        ))}
      </div>
    )
  }

  // Type === 'file'
  const highestSeverity = useMemo(() => {
    if (!item.findings || item.findings.length === 0) return null;
    const severityOrder: Severity[] = ['critical', 'blocker', 'high', 'medium', 'low'];
    let highest: Severity | null = null;
    for (const sev of severityOrder) {
        if (item.findings.some(f => f.severity === sev)) {
            highest = sev;
            break;
        }
    }
    return highest;
  }, [item.findings]);


  return (
    <div className="bg-white border-b border-gray-200 hover:bg-gray-50/50">
      <div
        className="flex items-center p-3"
        style={{ paddingLeft: `${level * 24 + 16}px` }}>
        <FiFileText className="mr-2 text-gray-600" />
        <div className="flex-grow">
            <span className="font-medium text-gray-800">{item.name}</span>
            <span className="text-gray-500 text-sm ml-2">({item.findings?.length} findings)</span>
        </div>
        <div className="flex items-center gap-2 pr-4">
             {highestSeverity && <span className={`capitalize text-xs font-bold px-2 py-1 rounded-full bg-${highestSeverity === 'critical' || highestSeverity === 'blocker' ? 'red' : 'yellow'}-100 text-${highestSeverity === 'critical' || highestSeverity === 'blocker' ? 'red' : 'yellow'}-800`}>{highestSeverity}</span>}
             <button onClick={(e) => handleViewClick(item.findings, item.path)} className="flex items-center gap-1 text-sm bg-gray-200 text-gray-800 px-3 py-1 rounded-md hover:bg-gray-300 transition-colors">
                 <FiEye />
                 View
             </button>
             <button onClick={(e) => handleEditClick(e, item.path)} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors">
                 <FiEdit/>
                 Edit
            </button>
        </div>
      </div>
    </div>
  )
}








const Scan = () => {
  const dispatch = useAppDispatch()
  const [severityFilter, setSeverityFilter] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isFileSystemModalOpen, setIsFileSystemModalOpen] = useState(false)
  const { jobId: runId, isProcessing } = useAppSelector(
    (state) => state.serverStatus,
  )
  const configValues = useAppSelector((state) => state.config)

  const { mutate: startScanMutation, isPending: isStartingScan } = useMutation({
    mutationFn: (body) => ScanService.startScan(body),
    onSuccess: (res) => {
      toast.loading(`Scanning...`)
      if (res?.run_id) {
        dispatch(startJob({ jobId: res.run_id, jobStatus: 'Starting' }))
      } else {
        dispatch(resetJob())
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start scan.')
      dispatch(resetJob());
    },
  })

  const { data: scanResult, isFetching: isFetchingScan } = useQuery({
    queryKey: [QueryKey.JOB, runId],
    queryFn: async() => {
      if (!runId) return null;
      const res=await ScanService.getResults(runId);
      if (res?.report||res?.findings) {
        toast.dismiss();
        toast.success("Scan complete!");
        dispatch(resetJob());
    }
      return res?.report||res?.findings
    },
    refetchOnWindowFocus: false,
    refetchInterval: isProcessing ? 3000 : false,
    enabled: !!runId && isProcessing,

  })

  const { data: lastScanResult, isLoading: isLoadingLastScan } = useQuery({
    queryKey: [QueryKey.JOB + 'last-scan'],
    queryFn: () => ScanService.getLastResultsByType('scan'),
    enabled: !isProcessing,
  })

  const report = isProcessing ? scanResult?.report : lastScanResult?.report
  const findings: Finding[] = report?.findings || []

  const handleFolderSelection = (path: string) => {
    startScanMutation({ path })
    setIsFileSystemModalOpen(false)
  }

  const groupedAndFilteredData = useMemo(() => {
    const filteredFindings = findings.filter((f) => {
      const sevMatch = severityFilter.length === 0 || severityFilter.includes(f.severity)
      const searchMatch =
        searchQuery === '' ||
        f.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.owasp_id.toLowerCase().includes(searchQuery.toLowerCase())
      return sevMatch && searchMatch
    });

    const filesMap: Record<string, Finding[]> = filteredFindings.reduce((acc, finding) => {
        if (!acc[finding.location]) {
            acc[finding.location] = [];
        }
        acc[finding.location].push(finding);
        return acc;
    }, {} as Record<string, Finding[]>);

    const root: GroupedFinding = { type: 'folder', name: 'root', path: '/', children: [] };
    
    Object.entries(filesMap).forEach(([fullPath, findingsInFile]) => {
        const parts = fullPath.split('/');
        let currentNode = root;

        parts.forEach((part, index) => {
            const currentPath = parts.slice(0, index + 1).join('/');
            if (index === parts.length - 1) { 
                 if (!currentNode.children) currentNode.children = [];
                currentNode.children.push({
                    type: 'file',
                    name: part,
                    path: fullPath,
                    findings: findingsInFile,
                });
            } else { 
                if (!currentNode.children) currentNode.children = [];
                let childNode = currentNode.children.find(child => child.path === currentPath);
                if (!childNode) {
                    childNode = {
                        type: 'folder',
                        name: part,
                        path: currentPath,
                        children: [],
                    };
                    currentNode.children.push(childNode);
                }
                currentNode = childNode;
            }
        });
    });

    return root.children || [];
  }, [findings, severityFilter, searchQuery]);


  const severityCounts = useMemo(() => {
    return findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [findings])

  const isLoading = isStartingScan || isProcessing || (isLoadingLastScan && !runId);

  return (
    <div className="flex sm:ml-50 bg-gray-50 min-h-screen">
      <main className="flex-1 p-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Scan Results</h1>
            <p className="text-gray-600 mt-1">Review security findings and vulnerabilities in your codebase.</p>
          </div>
          <div className="flex items-center gap-2">
            <ConfigurationInfo />
            <CommonButton
              loading={isStartingScan || isProcessing}
              onClick={() => setIsFileSystemModalOpen(true)}
              className="bg-primary text-white px-4 py-2 rounded-lg flex items-center shadow-sm hover:bg-blue-700 transition-colors disabled:bg-blue-300"
              disabled={isStartingScan || isProcessing}
            >
              <FiSearch className="mr-2" />
              <span>Scan for Findings</span>
            </CommonButton>
          </div>
        </header>

        {isFileSystemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setIsFileSystemModalOpen(false)}>
            <div className="h-3/4 w-3/4 overflow-hidden rounded-lg bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
              <FileSystemPage
                startLocation={configValues?.config?.sourcePath}
                setIsModalOpen={setIsFileSystemModalOpen}
                handleScan={handleFolderSelection}
              />
            </div>
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Total Findings"
            value={findings.length}
            icon={<FiAlertTriangle size={24} />}
            color="text-red-500"
          />
          {['critical', 'blocker', 'high', 'medium', 'low'].filter(sev => severityCounts[sev] > 0).map((sev) => (
             <StatCard
                key={sev}
                label={sev}
                value={severityCounts[sev] || 0}
                icon={<FiShield size={24} />}
                color="text-gray-500"
            />
          ))}
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200">
             <div className="p-4 flex items-center justify-between border-b border-gray-200">
                <div className="relative w-full max-w-sm">
                    <FiSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search findings by message, path..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                 <div className="flex items-center gap-2">
                    {['blocker', 'high', 'medium', 'low'].map((sev) => (
                    <button
                        key={sev}
                        onClick={() =>
                        setSeverityFilter((prev) =>
                            prev.includes(sev)
                            ? prev.filter((s) => s !== sev)
                            : [...prev, sev],
                        )
                        }
                        className={`rounded-full border px-4 py-1.5 text-sm capitalize font-medium transition-colors ${
                        severityFilter.includes(sev)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-300'
                        }`}
                    >
                        {sev}
                    </button>
                    ))}
                </div>
             </div>
        
            {isLoading ? (
                <FindingsSkeleton />
            ) : groupedAndFilteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
                    <FiShield size={48} className="mb-4 text-gray-400" />
                    <p className="text-lg font-semibold">No Findings Here</p>
                    <p className="mt-1 text-sm">
                    {findings.length > 0 ? "No results match your current filters." : "Run a new scan to find vulnerabilities."}
                    </p>
                </div>
            ) : (
                <div>
                    {groupedAndFilteredData.map((item) => (
                        <FindingRow key={item.path} item={item} />
                    ))}
                </div>
            )}
        </div>
      </main>
    </div>
  )
}




export default Scan
