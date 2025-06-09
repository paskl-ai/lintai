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

// import {  } from 'react-window'

import { TbActivity, TbGraph } from 'react-icons/tb'
import type { ListOnItemsRenderedProps } from 'react-window'



import Spinner from '../../components/Spinner'
import Skeleton from '../../components/skeleton/Skeleton'
import { QueryKey } from '../../api/QueryKey'
import { ScanService } from '../../api/services/Scan/scan.api'
import { useAppDispatch, useAppSelector } from '../../redux/services/store'
import { toast } from 'react-toastify'
import { resetJob } from '../../redux/services/ServerStatus/server.status.slice'
import { FiChevronDown, FiChevronRight, FiFolder } from 'react-icons/fi'

// ← export those props to clean the file

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
          color: 'red', // Optional: customize grid line color
        },
        ticks: {
          autoSkip: false,
          maxRotation: 0,
        },
      },
      y: {
        grid: {
          display: true,
          color: '#E5E7EB', // Optional: customize grid line color
        },
      },
    },
  },
}

const labels = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
]
let width = 0,
  height = 0,
  gradient = 0



const pieLabels = ['Medium', 'Large', 'Extra Large']
export const dynamicPieData = {
  labels: pieLabels,
  datasets: [
    {
      data: pieLabels.map(() => faker.number.int({ min: 10, max: 40 })),
      backgroundColor: ['#88D5B3', '#EA9E99', '#C59FF3'],
      borderColor: '#ffffff',
      borderWidth: 2,
    },
  ],
}

const barLabels = ['Server 1', 'Server 2', 'Server 3', 'Server 4']
export const dynamicBarData = {
  labels: barLabels,
  datasets: [
    {
      label: 'Dataset 1',
      data: barLabels.map(() => faker.number.int({ min: 10, max: 40 })),
      backgroundColor: '#88D5B3',
      stack: 'Stack 0',
    },
    {
      label: 'Dataset 2',
      data: barLabels.map(() => faker.number.int({ min: 10, max: 40 })),
      backgroundColor: '#EA9E99',
      stack: 'Stack 1',
    },
    {
      label: 'Dataset 3',
      data: barLabels.map(() => faker.number.int({ min: 10, max: 40 })),
      backgroundColor: '#C59FF3',
      stack: 'Stack 2',
    },
    {
      label: 'Dataset 4',
      data: barLabels.map(() => faker.number.int({ min: 10, max: 40 })),
      backgroundColor: '#EDC089',
      stack: 'Stack 3',
    },
  ],
}

const ROW_HEIGHT = 60 // px – adjust to taste
const LIST_HEIGHT = 800 // px – container height in the sidebar



/** ------------------------------------------------------------------ *
 *  DASHBOARD COMPONENT
 * -------------------------------------------------------------------*/
const Dashboard = () => {
  const { jobId: runId, isProcessing } = useAppSelector(state => state.serverStatus)

  const [selectedFilter, setSelectedFilter] = useState('hourly')
  const [selectedNetworkFilter, setSelectedNetworkFilter] = useState<
    'hourly' | 'daily'
  >('hourly')

  const [selectedServer, setSelectedServer] = useState('')
  const [selectedServerNetwork, setSelectedServerForNetwork] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [networkRecord, setNetworkRecord] = useState<any>(null);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState<boolean>(false);
  const dispatch = useAppDispatch()
  /* When the virtual list renders items near the bottom,
     trigger next page if available ----------------------------------*/

  const [expandedFiles, setExpandedFiles] = useState<string[]>([])

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

  const {
    data: history,
    isFetching: isFetchingHistory,
  } = useQuery({
    queryKey: [QueryKey.JOB + 'history'],
    queryFn: async () => {
      const res = await ScanService.getHistory(); // Fetch history using the new API
      return res;
    },
    initialData: [],
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const llmUsage = scans?.llm_usage || lastscan?.llm_usage;
  const findings: Finding[] = (scans?.findings || lastscan?.findings as Finding[]) ?? [];
  const filteredFindings = findings.filter((finding: Finding) => {
    const matchesSearch =
      finding.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.owasp_id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const inventoryRecords = scans?.data?.records || lastscan?.data?.records || [];
  const filteredInventoryRecords = inventoryRecords.filter((record: any) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      record.sink.toLowerCase().includes(searchLower) ||
      record.at.toLowerCase().includes(searchLower)
    )
  })
  const handleNetworkView = (record: any) => {
    setNetworkRecord(record);
    setIsNetworkModalOpen(true);
  };

  const closeNetworkModal = () => {
    setIsNetworkModalOpen(false);
    setNetworkRecord(null);
  };
  const groupedFindings = filteredFindings?.reduce((acc: { [x: string]: Finding[] }, finding: Finding) => {
    if (!acc[finding.location]) acc[finding.location] = []
    acc[finding.location].push(finding)
    return acc
  }, {} as Record<string, Finding[]>)
  // console.log(PerformanceMetricDATA, 'stat data')
  const getSeverityChip = (label: string, count: number, color: string) => (
    <span className={`border ${color} text-${color} px-2 py-1 rounded-sm text-sm font-bold`}>
      {label} {count}
    </span>
  )
  const toggleExpand = (filePath: string) => {
    setExpandedFiles((prev) =>
      prev.includes(filePath) ? prev.filter((path) => path !== filePath) : [...prev, filePath]
    )
  }
  return (
    <div className="p-6 sm:ml-50 ">
      <div className="flex flex-col gap-4 md:flex-row">
        {/* ───────────────────────────────────────── LEFT ─────────────────────────────────────── */}
        <div className="flex-1 space-y-6 sm:w-max md:w-2/3">
          {/* Metric cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            {/* card 1 */}
            <div className="bg-card_bgLight rounded-lg border p-4">
              <h3 className="text-sm font-medium text-neutral-950">
                Total Files Scanned
              </h3>
              {false ? (
                <Skeleton className="mt-4 h-8 w-full text-xl font-bold text-primary" />
              ) : (
                <p className="mt-4 text-xl font-bold text-primary">
                  {20}
                </p>
              )}
              {/* <p className="mt-4 text-sm text-neutral-600">
                +3 more than last month
              </p> */}
            </div>
            {/* card 2 */}
            <div className="bg-card_bgLight rounded-lg border p-4">
              <h3 className="text-sm font-medium text-neutral-950">
              Findings with OWASP
              </h3>
              {false ? (
                <Skeleton className="mt-4 h-8 w-full text-xl font-bold text-primary" />
              ) : (
                <p className="mt-4 text-xl font-bold text-primary">
                  12
                </p>
              )}
              {/* <button className="bg-primaryContainer text-primaryBgText mt-4 flex items-center gap-2 rounded-md px-3 py-1 text-sm font-bold shadow-sm hover:bg-gray-300">
                <FaPlus /> Invite user
              </button> */}
            </div>
            {/* card 3 */}
            <div className="bg-card_bgLight rounded-lg border p-4">
              <h3 className="text-sm font-medium text-neutral-950">
              Findings with Mitre
              </h3>
              <p className="mt-4 text-xl font-bold text-primary">6</p>
              {/* <p className="mt-4 text-sm text-neutral-600">15% under budget</p> */}
            </div>
          </div>


        </div>

        {/* ───────────────────────────────────────── RIGHT – ALERTS ───────────────────────────── */}

      </div>
 
      <div className="py-3 font-semibold text-lg border-b border-primary">
        History of Scans
      </div>
      <div>
        {isFetchingHistory ? (
          <div className="text-gray-500">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="my-20 flex flex-col items-center justify-center h-full text-gray-500">
            <FiFolder size={48} className="mb-4" />
            <p className="text-lg font-semibold">No scan history found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history?.map((item: any, index: number) => (
              <div key={index} className="border rounded-lg p-4 shadow-sm bg-white">
                <div className="flex flex-col space-y-2">
                  <p className="text-lg font-bold text-gray-800">Scan Type: {item?.type}</p>
                  <p className="text-sm text-gray-600">
                    Date: {moment(item?.date).format('MMMM Do YYYY, h:mm:ss a')}
                  </p>
                  <p className="text-sm text-gray-600">
                    Files Scanned: {item?.files?.length > 0 ? item?.files?.join(", ") : "No files scanned"}
                  </p>
                  {item?.errors && (
                    <p className="text-sm text-red-500">Errors: {item?.errors}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
