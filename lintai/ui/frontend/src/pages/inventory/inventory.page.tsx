/* ---------------------------------------------------------------------
 *  Inventory.page.tsx
 *  Re‑built with the shared <Table /> component so the inventory view
 *  matches your server‑list & new Scan table UI.
 * ------------------------------------------------------------------- */

import React, { useState } from 'react'
import {
  FiSearch,
  FiFolder,
} from 'react-icons/fi'
import { TbGraph } from 'react-icons/tb'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, Row } from '@tanstack/react-table'

import {
  scanInventoryDTO,
  ScanService,
} from '../../api/services/Scan/scan.api'
import CommonButton from '../../components/buttons/CommonButton'
import ConfigurationInfo from '../../components/configurationInfo/ConfigurationInfo'
import FileSystemPage from '../filesystem/filesystem.page'
import Table from '../../components/table/Table'
import DataFlowVisualise from '../graph/DataFlowVisualise'

import { QueryKey } from '../../api/QueryKey'
import {
  resetJob,
  startJob,
} from '../../redux/services/ServerStatus/server.status.slice'
import { useAppDispatch, useAppSelector } from '../../redux/services/store'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface InventoryRecord {
  sink: string             // e.g. “Postgres DB”
  at: string               // “examples/db.py:42”
  elements: any            // payload for graph visualiser
}

interface LLMUsage {
  tokens_used: number
  usd_used: number
  requests: number
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const Inventory = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()

  /* ------------------------------ Local state -------------------- */
  const [searchQuery, setSearchQuery] = useState('')
  const [isFileSystemModalOpen, setIsFileSystemModalOpen] =
    useState<boolean>(false)
  const [networkRecord, setNetworkRecord] = useState<InventoryRecord | null>(
    null,
  )
  const [isNetworkModalOpen, setIsNetworkModalOpen] =
    useState<boolean>(false)

  /* ------------------------------ Global state ------------------- */
  const { jobId: runId, isProcessing } = useAppSelector(
    (state) => state.serverStatus,
  )
  const configValues = useAppSelector((state) => state.config)

  /* ------------------------------ Mutation ----------------------- */
  const { mutate: startScanInventory } = useMutation({
    mutationFn: async (body: scanInventoryDTO) =>
      await ScanService.scanInventory(body),
    onSuccess: (res, data) => {
      toast.loading(
        `Scanning path: ${
          (data as scanInventoryDTO)?.path || configValues?.config?.sourcePath
        }`,
      )

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [QueryKey.JOB + 'inventory'] })
      }, 2_000)

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
    onError: (err: any) =>
      toast.error(err.message || 'Failed to start inventory scan.'),
  })

  /* ------------------------------ Queries ------------------------ */
  const {
    data: scans,
    isFetching: isFetchingScan,
    error: scanError,
  } = useQuery({
    queryKey: [QueryKey.JOB + 'inventory'],
    queryFn: async () => {
      const res = await ScanService.getResults(runId!)
      if (res?.data) {
        dispatch(resetJob())
        toast.dismiss()
      }
      return res
    },
    initialData: [],
    refetchOnWindowFocus: false,
    refetchInterval: isProcessing ? 3_000 : false,
    enabled: !!runId,
  })

  const {
    data: lastscan,
    isFetching: isFetchingLastScan,
    error: lastScanError,
  } = useQuery({
    queryKey: [QueryKey.JOB + 'last-inventory'],
    queryFn: async () => (await ScanService.getLastResultsByType('inventory')).report,
    initialData: [],
    refetchOnWindowFocus: false,
    enabled: !scans?.data?.records,
  })

  /* ------------------------------ Derived data ------------------- */
  const llmUsage: LLMUsage | undefined =
    scans?.llm_usage || lastscan?.llm_usage

  const records: InventoryRecord[] =
    scans?.data?.records ||
    lastscan?.data?.records ||
    []

  const tableData: InventoryRecord[] = records.filter((rec) =>
    `${rec.sink} ${rec.at}`.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if(lastScanError||scanError) {
      dispatch(resetJob())
      toast.dismiss()
  }
  /* ------------------------------ Column defs -------------------- */
  const columns: ColumnDef<InventoryRecord>[] = [
    { accessorKey: 'sink', header: 'Sink' },
    {
      accessorKey: 'at',
      header: 'Location',
      cell: ({ getValue }) => {
        const loc = getValue<string>() // examples/foo.py:12
        const [file, line] = loc.split(':')
        return (
          <span className="text-sm">
            <span className="text-red-700">{file}</span>
            <span className="text-blue-700">:</span>
            <span className="text-green-700 font-semibold">{line}</span>
          </span>
        )
      },
    },
    {
      header: 'Actions',
      cell: ({ row }) => {
        const rec = row.original
        return (
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-blue-500 px-3 py-1 text-xs text-blue-500 hover:bg-blue-500 hover:text-white"
              onClick={(e) => {
                e.stopPropagation()
                setNetworkRecord(rec)
                setIsNetworkModalOpen(true)
              }}
            >
              View <TbGraph className="ml-1 inline" />
            </button>
            <a
              href={`vscode://file/${rec.at}`}
              className="rounded-md border border-green-500 px-3 py-1 text-xs text-green-500 hover:bg-green-500 hover:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              Edit
            </a>
          </div>
        )
      },
    },
  ]

  /* ------------------------------ Helpers ------------------------ */
  const handleFolderSelection = (path: string) => {
    startScanInventory({
      path,
      logLevel: 'info',
      depth: 1,
    })
  }

  const closeNetworkModal = () => {
    setIsNetworkModalOpen(false)
    setNetworkRecord(null)
  }

  const handleRowClick = (row: Row<InventoryRecord>) => {
    setNetworkRecord(row.original)
    setIsNetworkModalOpen(true)
  }

  /* ----------------------------------------------------------------
   *  Render
   * -------------------------------------------------------------- */

  return (
    <div className="flex p-6 sm:ml-50">
      <main className="flex-1">
        {/* Top bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-gray-700">Scan Inventory</h3>

          <div className="flex items-center gap-2">
            <ConfigurationInfo />
{/*
            <div className="relative">
              <FiSearch className="absolute left-3 top-2.5 text-gray-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…"
                className="w-64 rounded border py-2 pl-10 pr-4"
              />
            </div> */}

            <CommonButton
              loading={isProcessing}
              onClick={() => setIsFileSystemModalOpen(true)}
              className="flex items-center bg-primary px-4 py-2 text-white"
            >
              <FiFolder className="mr-2" />
              Run scan
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

        {/* LLM stats */}
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

        {/* Inventory table */}
        <Table
        //   loading={isFetchingScan || isFetchingLastScan}
          data={tableData}
          columns={columns}

        //   handleRowClick={handleRowClick}
        //   pageSize={10}
        //   enableSorting
        />

        {/* Graph modal */}
        {isNetworkModalOpen && networkRecord && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="h-full w-2/4 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="text-lg font-semibold">
                  Data Flow Visualisation
                </h2>
                <button
                  onClick={closeNetworkModal}
                  className="rounded bg-primary px-4 py-2 text-white hover:bg-primary/80"
                >
                  Close
                </button>
              </div>
              <div className="h-full overflow-y-auto p-4">
                <DataFlowVisualise records={networkRecord} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

/* ------------------------------ Helper --------------------------- */
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

export default Inventory
