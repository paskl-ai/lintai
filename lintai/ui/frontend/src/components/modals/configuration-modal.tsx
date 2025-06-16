import React, { useState } from 'react'

interface ConfigurationModalProps {
  onClose: () => void
  onSave: (config: Record<string, string | number | null>) => void
}

const ConfigurationModal: React.FC<ConfigurationModalProps> = ({ onClose, onSave }) => {
  const [depth, setDepth] = useState(1)
  const [logLevel, setLogLevel] = useState('info')
  const [apiKeys, setApiKeys] = useState<string[]>([''])
  const [aiModels, setAiModels] = useState<string[]>([''])
  const [llmProvider, setLlmProvider] = useState<string | null>(null)
  const [maxLlmCost, setMaxLlmCost] = useState<number | null>(null)
  const [maxLlmRequests, setMaxLlmRequests] = useState<number | null>(null)
  const [maxLlmTokens, setMaxLlmTokens] = useState<number | null>(null)
  const [llmApiVersion, setLlmApiVersion] = useState<string | null>(null)
  const [llmEndpointUrl, setLlmEndpointUrl] = useState<string | null>(null)
  const [llmModelName, setLlmModelName] = useState<string | null>(null)

  const handleSave = () => {
    onSave({
      depth,
      logLevel,
    //   apiKeys,
    //   aiModels,
      LINTAI_LLM_PROVIDER: llmProvider,
      LINTAI_MAX_LLM_COST_USD: maxLlmCost,
      LINTAI_MAX_LLM_REQUESTS: maxLlmRequests,
      LINTAI_MAX_LLM_TOKENS: maxLlmTokens,
      LLM_API_VERSION: llmApiVersion,
      LLM_ENDPOINT_URL: llmEndpointUrl,
      LLM_MODEL_NAME: llmModelName,
    })
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
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">LLM Provider</label>
          <input
            type="text"
            value={llmProvider || ''}
            onChange={(e) => setLlmProvider(e.target.value || null)}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Max LLM Cost (USD)</label>
          <input
            type="number"
            value={maxLlmCost || ''}
            onChange={(e) => setMaxLlmCost(e.target.value ? Number(e.target.value) : null)}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Max LLM Requests</label>
          <input
            type="number"
            value={maxLlmRequests || ''}
            onChange={(e) => setMaxLlmRequests(e.target.value ? Number(e.target.value) : null)}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Max LLM Tokens</label>
          <input
            type="number"
            value={maxLlmTokens || ''}
            onChange={(e) => setMaxLlmTokens(e.target.value ? Number(e.target.value) : null)}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">LLM API Version</label>
          <input
            type="text"
            value={llmApiVersion || ''}
            onChange={(e) => setLlmApiVersion(e.target.value || null)}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">LLM Endpoint URL</label>
          <input
            type="text"
            value={llmEndpointUrl || ''}
            onChange={(e) => setLlmEndpointUrl(e.target.value || null)}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">LLM Model Name</label>
          <input
            type="text"
            value={llmModelName || ''}
            onChange={(e) => setLlmModelName(e.target.value || null)}
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
