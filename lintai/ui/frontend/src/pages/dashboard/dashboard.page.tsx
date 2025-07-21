
// Dashboard.tsx
import { faker } from '@faker-js/faker'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import moment from 'moment'
import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { FaPlus } from 'react-icons/fa6'
import { TbActivity, TbGraph, TbScan } from 'react-icons/tb'
import type { ListOnItemsRenderedProps } from 'react-window'
import {
  FiChevronDown,
  FiChevronRight,
  FiFileText,
  FiFolder,
  FiAlertCircle,
  FiCheckCircle,
} from 'react-icons/fi'

import Spinner from '../../components/Spinner'
import Skeleton from '../../components/skeleton/Skeleton'
import { QueryKey } from '../../api/QueryKey'
import { AnalysisService } from '../../api/services/Scan/analysis.api'
import { useAppDispatch, useAppSelector } from '../../redux/services/store'
import { toast } from 'react-toastify'
import { resetJob } from '../../redux/services/ServerStatus/server.status.slice'
import { StatCard } from '../../components/stateCard/StateCard'
import { useNavigate } from 'react-router'
import Pagination from '../../components/pagination/Pagination'

const CustomGraph = lazy(
  async () => import('../../components/graph/CustomGraph'),
)
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

interface Finding {
  owasp_id: string
  severity: 'blocker' | 'high' | 'medium' | 'low'
  message: string
  location: string
  line: number
  fix: string
}

export const options = {
  responsive: true,
  plugins: {
    legend: false,
    scales: {
      x: {
        grid: {
          display: true,
          color: 'red',
        },
        ticks: {
          autoSkip: false,
          maxRotation: 0,
        },
      },
      y: {
        grid: {
          display: true,
          color: '#E5E7EB',
        },
      },
    },
  },
}

const HistoryItem = ({ item, index }: { item: any; index: number }) => {
  const [isExpanded, setIsExpanded] = useState(false)
const navigate=useNavigate()
  const toggleExpand = () =>{

    if(item.type == 'find_issues') {
      setIsExpanded(!isExpanded)
    }
    else{
      navigate(`/catalog/${encodeURIComponent(item?.run?.run_id)}`, { state: item });

    }

    }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <FiCheckCircle className="text-green-500" size={20} />
      case 'error':
        return <FiAlertCircle className="text-red-500" size={20} />
      default:
        return <FiFileText size={20} />
    }
  }

  const getSeverityChipClass = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'blocker':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const findingsCount = item?.report?.findings?.length || item?.report?.inventory_by_file?.length || 0

  return (
    <div className="border rounded-lg shadow-md bg-white mb-4 overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={toggleExpand}>
        <div className="flex items-center space-x-4">
          {getStatusIcon(item?.run?.status)}
          <div>
            <p className="text-lg font-semibold text-gray-800 capitalize">
              {item?.type=='find_issues' ? 'Finding' : 'AI Catalog'}
              <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                {item?.run?.path}
              </span>
            </p>
            <p className="text-sm text-gray-500">
              {moment(item?.date).format('MMMM Do YYYY, h:mm:ss a')}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span
            className={`px-3 py-1 text-sm font-semibold rounded-full ${
              findingsCount > 0
                ? 'bg-red-100 text-red-800'
                : 'bg-green-100 text-green-800'
            }`}>
            {findingsCount} {item?.type!=='find-issues'?"Files analysed":'Findings'}
          </span>
          <button className="text-gray-500 hover:text-gray-700">
            {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
          </button>
        </div>
      </div>

      {isExpanded && item?.type=='find_issues' && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="font-semibold text-gray-700">Run Details</h4>
              <p className="text-sm text-gray-600">
                <strong>Run ID:</strong> {item?.run?.run_id}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Status:</strong>{' '}
                <span
                  className={`capitalize font-semibold ${
                    item?.run?.status === 'error'
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}>
                  {item?.run?.status}
                </span>
              </p>
            </div>
            {item?.report?.llm_usage && (
              <div>
                <h4 className="font-semibold text-gray-700">LLM Usage</h4>
                <p className="text-sm text-gray-600">
                  <strong>Tokens Used:</strong>{' '}
                  {item?.report?.llm_usage?.tokens_used}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>USD Used:</strong> $
                  {item?.report?.llm_usage.usd_used?.toFixed(5)}
                </p>
              </div>
            )}
          </div>

          <div>
            <h4 className="font-semibold text-gray-700 mb-2">Findings</h4>
            {findingsCount > 0 ? (
              <div className="space-y-3">
                {item?.report?.findings?.map(
                  (finding: any, findIndex: number) => (
                    <div
                      key={findIndex}
                      className="p-3 bg-white rounded-md border border-gray-200">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-md text-gray-800">
                          {finding?.message}
                        </p>
                        <span
                          className={`px-2 py-1 text-xs font-bold rounded-full border ${getSeverityChipClass(
                            finding?.severity,
                          )}`}>
                          {finding?.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        In{' '}
                        <span className="font-mono bg-gray-100 px-1 rounded">
                          {finding?.location}
                        </span>{' '}
                        at line{' '}
                        <span className="font-semibold">{finding?.line}</span>
                      </p>
                      <p className="text-sm text-green-700 mt-2">
                        <span className="font-semibold">Fix:</span>{' '}
                        {finding?.fix}
                      </p>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No findings for this analysis.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const Dashboard = () => {
  const { jobId: runId, isProcessing } = useAppSelector(
    state => state.serverStatus,
  )
  const [selectedFilter, setSelectedFilter] = useState('hourly')
  const [selectedNetworkFilter, setSelectedNetworkFilter] = useState<
    'hourly' | 'daily'
  >('hourly')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const dispatch = useAppDispatch()
  const [expandedFiles, setExpandedFiles] = useState<string[]>([])





  const { data: history, isFetching: isFetchingHistory } = useQuery({
    queryKey: [QueryKey.JOB + 'history'],
    queryFn: async () => {
      const res = await AnalysisService.getHistory()
      // Sort by date with latest entries at top
      return res.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    },
    initialData: [],
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })

  // Apply client-side pagination
  const totalItems = history.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedHistory = history.slice(startIndex, endIndex)

  const historyResponse = {
    items: paginatedHistory,
    total: totalItems,
    page: currentPage,
    limit: itemsPerPage,
    pages: totalPages
  }  // Calculate statistics from actual data
  const stats = useMemo(() => {
    let totalFindings = 0
    let scanOperations = 0
    let inventoryOperations = 0
    const uniqueAIFiles = new Set<string>()

    history.forEach((item: any) => {
      // Count AI workflow files from inventory data
      if (item?.type === 'catalog_ai') {
        inventoryOperations++
        if (item?.report?.inventory_by_file?.length) {
          // Count unique files that actually have AI/ML components
          item.report.inventory_by_file.forEach((file: any) => {
            if (file?.components?.length > 0 || file?.frameworks?.length > 0) {
              uniqueAIFiles.add(file.file_path)
            }
          })
        }
      }

      // Count all findings from scan data
      if (item?.type === 'find_issues') {
        scanOperations++
        if (item?.report?.findings?.length) {
          totalFindings += item.report.findings.length
        }
      }
    })

    return {
      totalAIWorkflowFiles: uniqueAIFiles.size,
      totalFindings,
      scanOperations,
      inventoryOperations
    }
  }, [history])

  return (
    <div className="p-6 sm:ml-50 bg-gray-50 ">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1 space-y-6 sm:w-max md:w-2/3">          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
          <StatCard
            label="Total AI Workflow Files"
            value={stats.totalAIWorkflowFiles}
            // ={TbScan}
          />
          <StatCard
            label="Total Security Findings"
            value={stats.totalFindings}

          />
          <StatCard
            label="Security Analysis"
            value={stats.scanOperations}

          />
          <StatCard
            label="AI Catalog Runs"
            value={stats.inventoryOperations}

          />
          </div>
        </div>
      </div>

      <div className="py-3 mt-6 font-semibold text-xl border-b border-gray-300">
        History of Scans
      </div>
      <div className="mt-4">
        {isFetchingHistory ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <Spinner />
            <span className="ml-2">Loading history...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="my-20 flex flex-col items-center justify-center h-full text-gray-500">
            <FiFolder size={48} className="mb-4" />
            <p className="text-lg font-semibold">No scan history found</p>
          </div>
        ) : (
          <div>
            {paginatedHistory?.map((item: any, index: number) => (
              <HistoryItem key={item?.run?.run_id || index} item={item} index={index} />
            ))}
          </div>
        )}

        {historyResponse && historyResponse.pages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={historyResponse.pages}
            onPageChange={setCurrentPage}
            totalItems={historyResponse.total}
            itemsPerPage={itemsPerPage}
            className="mt-4"
          />
        )}
      </div>
    </div>
  )
}

export default Dashboard;
