/* ------------------------------------------------------------------
 * ConfigurationInfo.tsx
 * Shows the current config slice in a modal dialog.
 * ----------------------------------------------------------------*/
import React, { useState } from 'react'
import { FiMaximize2, FiX } from 'react-icons/fi'
import { useNavigate } from 'react-router'
import { useAppSelector } from '../../redux/services/store'

const ConfigurationInfo = () => {
  const navigate = useNavigate()
  const configValues = useAppSelector((state) => state.config)
  const [isOpen, setIsOpen] = useState(false)

  const openModal  = () => setIsOpen(true)
  const closeModal = () => setIsOpen(false)
  const goToConfig = () => {
    closeModal()
    navigate('/settings')
  }

  return (
    <>
      {/* trigger button */}
      <button
        onClick={openModal}
        className="flex items-center gap-1 rounded border px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
      >
        <FiMaximize2 size={14} />
        Configuration
      </button>

      {/* modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6">
          <div className="relative w-full max-w-lg rounded-lg bg-white shadow-lg">
            {/* header */}
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold">Configuration</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-800">
                <FiX size={20} />
              </button>
            </div>

            {/* JSON block */}
            <div className="max-h-[60vh] overflow-auto p-4">
              <pre className="rounded-md border bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">
                {JSON.stringify(configValues, null, 2)}
              </pre>
            </div>

            {/* footer */}
            <div className="flex justify-end gap-2 border-t p-4">
              <button
                onClick={goToConfig}
                className="rounded border border-primary px-4 py-2 text-primary hover:bg-primary hover:text-white"
              >
                Edit
              </button>
              <button
                onClick={closeModal}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ConfigurationInfo
