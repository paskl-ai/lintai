import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import React from 'react'
import { Line, Bar, Pie } from 'react-chartjs-2'
import { FiArrowRight, FiArrowUp } from 'react-icons/fi'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

interface CustomGraphProps {
  type: 'line' | 'bar' | 'pie'
  data: any
  options?: any
  title?: string
  verticalLabel?: string
  horizontalLabel?: string
  filters?: React.ReactNode
  legendPosition?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

// Updated CustomGraph component with pie chart adjustments
const CustomGraph: React.FC<CustomGraphProps> = ({
  type,
  data,
  options = {},
  title,
  verticalLabel,
  horizontalLabel,
  filters,
  legendPosition = 'top',
  className,
}) => {
  const ChartComponent = {
    line: Line,
    bar: Bar,
    pie: Pie,
  }[type]

  // Pie-specific configuration
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Disable default legend
        position: legendPosition,
        ...(options.plugins?.legend || {}),
      },
    },
    ...(type === 'pie' && {
      scales: {}, // Disable all scales for pie charts
    }),
  }

  // Merge user options last to allow overrides
  const mergedOptions = deepMerge(baseOptions, options)

  return (
    <div className={`flex flex-col rounded-md bg-neutral-50 p-4 ${className}`}>
      {/* Header Section */}
      <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        {title && (
          <h3 className="text-sm font-medium text-gray-800">{title}</h3>
        )}

        <div className="flex flex-wrap items-center gap-4">
          {/* Only show axis labels for line/bar charts */}
          {type !== 'pie' && (verticalLabel || horizontalLabel) && (
            <div className="mr-4 flex items-center gap-4">
              {verticalLabel && (
                <div className="flex items-center gap-1">
                  <FiArrowUp className="text-primary" />
                  <span className="text-xs font-medium">{verticalLabel}</span>
                </div>
              )}
              {horizontalLabel && (
                <div className="flex items-center gap-1">
                  <FiArrowRight className="text-primary" />
                  <span className="text-xs font-medium">{horizontalLabel}</span>
                </div>
              )}
            </div>
          )}

          {filters && (
            <div className="flex flex-wrap items-center gap-2">{filters}</div>
          )}
        </div>
      </div>

      {/* Chart Container */}
      <div className={`relative h-64 ${type === 'bar' ? 'w-150' : 'w-full'} `}>
        <ChartComponent
          data={data}
          options={mergedOptions}
          {...(type === 'pie' && {
            // Pie-specific additional props
            data: {
              ...data,
              datasets: data.datasets.map((dataset: any) => ({
                ...dataset,
                // borderWidth: 2,
                // hoverBorderWidth: 3,
              })),
            },
          })}
        />
      </div>

      {/* Enhanced Custom Legend for Pie Charts */}
      {type === 'pie' && data?.labels && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
          {data.labels.map((label: string, index: number) => (
            <div key={label} className="flex items-center justify-center gap-2">
              <div
                className="h-3 w-3 rounded-full shadow-sm"
                style={{
                  backgroundColor: data.datasets[0].backgroundColor[index],
                }}
              />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-800">
                  {label}
                </span>
                <span className="text-xs text-gray-500">
                  {data.datasets[0].data[index]}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Helper function for deep merging objects
const deepMerge = (target: any, source: any) => ({
  ...target,
  ...source,
  plugins: {
    ...target.plugins,
    ...source.plugins,
    legend: {
      ...target.plugins?.legend,
      ...source.plugins?.legend,
    },
  },
  scales: {
    ...target.scales,
    ...source.scales,
  },
})

export default CustomGraph
