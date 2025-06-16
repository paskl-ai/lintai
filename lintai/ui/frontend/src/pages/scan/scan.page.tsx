/* ---------------------------------------------------------------------
 *  Scan.page.tsx
 *  Completely refactored to use the <Table /> component (shared with
 *  server‑list) instead of the old “Sonar” accordion layout.
 * ------------------------------------------------------------------- */

import React, { useEffect, useState } from 'react'
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

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

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
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const Scan = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()

  /* ------------------------------ UI state ------------------------ */
  const [severityFilter, setSeverityFilter] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isFileSystemModalOpen, setIsFileSystemModalOpen] =
    useState<boolean>(false)
  const [fileSearchQuery, setFileSearchQuery] = useState<string>('')

  /* ------------------------------ Global state -------------------- */
  const { jobId: runId, isProcessing } = useAppSelector(
    (state) => state.serverStatus,
  )
  const configValues = useAppSelector((state) => state.config) // sourcePath etc.

  /* ------------------------------ Mutations ----------------------- */
  const { mutate: startScan } = useMutation({
    mutationFn: async (body: startScanDTO | FormData) =>
      await ScanService.startScan(body),
    onSuccess: (res, data) => {
      toast.loading(
        `Scanning path: ${
          (data as startScanDTO)?.path || configValues?.config?.sourcePath
        }`,
      )

     

      if (res?.run_id) {
        dispatch(
          startJob({
            jobId: res.run_id as any,
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

  /* ------------------------------ Queries ------------------------- */
  const {
    data: scans,
    isFetching: isFetchingScan,
    error: scanError,
  } = useQuery({
    queryKey: [QueryKey.JOB],
    queryFn: async () => {
      const res = await ScanService.getResults(runId!)
      if (res?.data || res?.findings) {
        dispatch(resetJob())
        toast.dismiss()
      }
      return res
    },
    initialData: [],
    refetchOnWindowFocus: false,
    refetchInterval: isProcessing ? 3000 : false,
    enabled: !!runId,
  })

  const {
    data: lastscan,
    isFetching: isFetchingLastScan,
    error: lastScanError,
  } = useQuery({
    queryKey: [QueryKey.JOB + 'last-scan'],
    queryFn: async () => {
      const res = await ScanService.getLastResultsByType('scan')
      if (res?.data || res?.findings) {
        dispatch(resetJob())
        toast.dismiss()
      }
      return res.report
    },

    initialData: [],
    refetchOnWindowFocus: false,
    refetchInterval: isProcessing ? 3_000 : false,
    enabled: !scans?.findings,
  })

if(lastScanError||scanError) {
  console.log('scanError', scanError)
  console.log('lastScanError', lastScanError)
    dispatch(resetJob())
    toast.dismiss()
}

  /* ------------------------------ Derived data -------------------- */
  const llmUsage: LLMUsage | undefined =
    scans?.llm_usage || lastscan?.llm_usage

  const findings: Finding[] =
    (scans?.findings || lastscan?.findings || []) as Finding[]

  /** Apply severity + search filters for the table. */
  const tableData: Finding[] = findings.filter((f) => {
    const sevMatch =
      severityFilter.length === 0 || severityFilter.includes(f.severity)
    const searchMatch =
      f.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.owasp_id.toLowerCase().includes(searchQuery.toLowerCase())
    return sevMatch && searchMatch
  })

  /* ------------------------------ Column defs --------------------- */
  const columns: ColumnDef<Finding>[] = [
    { accessorKey: 'owasp_id', header: 'Finding Title' },
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: ({ getValue }) => {
        const sev = getValue<string>()
        const color =
          sev === 'blocker'
            ? 'bg-red-600 text-white'
            : sev === 'high'
            ? 'bg-orange-500 text-white'
            : sev === 'medium'
            ? 'bg-yellow-400 text-black'
            : 'bg-green-500 text-white'
        return (
          <span className={`rounded px-2 py-1 text-xs font-bold ${color}`}>
            {sev.toUpperCase()}
          </span>
        )
      },
    },
    { accessorKey: 'location', header: 'Location' },
    { accessorKey: 'line', header: 'Line No.' },
    {
      accessorKey: 'fix',
      header: 'Fix',
      cell: ({ getValue }) => (
        <span className="line-clamp-1 max-w-xs text-xs text-gray-700">
          {getValue<string>()}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: ({ row }) => {
        const rec = row.original
        return (
          <div className="flex items-center gap-2">
            <p
              className="rounded-md   px-3 py-1 text-lg text-primary hover:text-white"
              onClick={(e) => {
                e.stopPropagation()
                // setNetworkRecord(rec)
                // setIsNetworkModalOpen(true)
              }}
            >
              View Scan 
            </p>
            {/* <a
              href={`vscode://file/${rec.at}`}
              className="rounded-md border border-green-500 px-3 py-1 text-xs text-green-500 hover:bg-green-500 hover:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              Edit
            </a> */}
          </div>
        )
      },
    },
  ]

  /* ------------------------------ Helpers ------------------------- */
  const handleFolderSelection = (path: string) => {
    startScan({ path })
  }

  /* ----------------------------------------------------------------
   *  Render
   * -------------------------------------------------------------- */

  return (
    <div className="flex sm:ml-50">
      <main className="flex-1 p-6">
        {/* Top‑bar — filters, search, “Scan” */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          {/* Severity chips */}
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-700">Severity</h3>
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
                className={`rounded border px-3 py-1 text-sm capitalize ${
                  severityFilter.includes(sev)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-primary border-primary'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* RHS controls */}
          <div className="flex flex-row items-center gap-2">
            <ConfigurationInfo />


            <CommonButton
              loading={isProcessing}
              onClick={() => setIsFileSystemModalOpen(true)}
              className="bg-primary text-white px-4 py-2 rounded flex flex-row min-w-fit items-center"
            >
              <FiFolder className="mr-2" />
              <p>
              Scan for Findings

              </p>
            </CommonButton>
          </div>
        </div>

        {/* File‑system picker modal */}
        {isFileSystemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="h-3/4 w-3/4 overflow-hidden rounded-lg bg-white shadow-lg">
              <FileSystemPage
                startLocation={configValues?.config?.sourcePath}
                setIsModalOpen={setIsFileSystemModalOpen}
                handleScan={handleFolderSelection}
              />
            </div>
          </div>
        )}

        {/* LLM usage summary */}
        {llmUsage && (
          <div className="mb-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Tokens used" value={llmUsage.tokens_used} />
            <StatCard
              label="Total Cost"
              value={`$${llmUsage.usd_used.toFixed(2)}`}
            />
            <StatCard label="LLM Requests" value={llmUsage.requests} />
          </div>
        )}

        {/* Findings Table */}
        <Table

          data={tableData}
          columns={columns}
        //   pageSize={10}
        //   enableSorting
        />

        {/* Empty state */}
        {/* {tableData.length === 0 && !isFetchingScan && !isFetchingLastScan && (
          <div className="flex h-64 flex-col items-center justify-center text-gray-500">
            <FiFolder size={48} className="mb-4" />
            <p className="text-lg font-semibold">No findings available</p>
            <p className="mt-2 text-sm">
              Add a repository or change filters to see results.
            </p>
          </div>
        )} */}
      </main>
    </div>
  )
}

/* ------------------------------ Small helpers --------------------- */
const StatCard = ({
  label,
  value,
}: {
  label: string
  value: number | string
}) => (
  <div className="rounded-lg border-2 border-neutral-100 bg-card_bgLight p-4">
    <h3 className="text-lg font-semibold text-gray-800">{label}</h3>
    <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
  </div>
)

export default Scan
