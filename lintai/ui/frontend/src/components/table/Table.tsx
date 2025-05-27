import type { ColumnDef } from '@tanstack/react-table'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useState } from 'react'

interface TableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
}

const Table = <T,>({ data, columns }: TableProps<T>) => {
  const [globalFilter, setGlobalFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>(
    {},
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  })

  return (
    <div className="p-4">
      {/* Table Controls (Search & Filter Button) */}
      <div className="mb-4 flex items-center justify-between">
        <input
          type="text"
          placeholder="Search..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-gray-700 shadow-sm focus:border-black focus:ring focus:ring-gray-200"
        />

        {/* Filter Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="ml-4 rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300"
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Column Filters Section (Toggles on Button Click) */}
      {showFilters && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {table.getHeaderGroups().map((headerGroup) =>
            headerGroup.headers.map((header) =>
              header.column.getCanFilter() ? (
                <div key={header.id} className="flex flex-col">
                  <label className="text-sm font-bold text-gray-700">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </label>
                  <input
                    type="text"
                    placeholder={`Filter ${header.column.columnDef.header}`}
                    value={columnFilters[header.id] || ''}
                    onChange={(e) => {
                      setColumnFilters({
                        ...columnFilters,
                        [header.id]: e.target.value,
                      })
                      header.column.setFilterValue(e.target.value)
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-gray-700 focus:border-black focus:ring focus:ring-gray-200"
                  />
                </div>
              ) : null,
            ),
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-300">
        <table className="w-full border-collapse bg-white text-left text-gray-800">
          {/* Table Head */}
          <thead className="bg-gray-100">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-gray-300">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="cursor-pointer px-4 py-3 text-sm font-bold tracking-wide"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}{' '}
                    {header.column.getIsSorted() === 'asc'
                      ? '▲'
                      : header.column.getIsSorted() === 'desc'
                        ? '▼'
                        : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          {/* Table Body */}
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-300 hover:bg-gray-100"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  No results found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="mt-4 flex items-center justify-between">
        <button
          className="rounded-md border border-gray-300 px-3 py-2 text-gray-700 shadow-sm disabled:opacity-50"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </button>

        <span className="text-gray-700">
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </span>

        <button
          className="rounded-md border border-gray-300 px-3 py-2 text-gray-700 shadow-sm disabled:opacity-50"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default Table
