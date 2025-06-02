import React, { useState } from 'react'

interface ConfigurationModalProps {
  onClose: () => void
  onSave: (depth: number, logLevel: string, apiKeys: string[], aiModels: string[]) => void
}

const ConfigurationModal: React.FC<ConfigurationModalProps> = ({ onClose, onSave }) => {
  const [depth, setDepth] = useState(1)
  const [logLevel, setLogLevel] = useState('info')
  const [apiKeys, setApiKeys] = useState<string[]>([''])
  const [aiModels, setAiModels] = useState<string[]>([''])

  const handleSave = () => {
    onSave(depth, logLevel, apiKeys, aiModels)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h2 className="text-xl font-bold mb-4">Configuration</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Depth</label>
          <input
            type="number"
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Log Level</label>
          <select
            value={logLevel}
            onChange={(e) => setLogLevel(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            <option value="info">Info</option>
            <option value="debug">Debug</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">API Keys</label>
          <textarea
            value={apiKeys.join('\n')}
            onChange={(e) => setApiKeys(e.target.value.split('\n'))}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">AI Models</label>
          <textarea
            value={aiModels.join('\n')}
            onChange={(e) => setAiModels(e.target.value.split('\n'))}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfigurationModal
