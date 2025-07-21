import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfigDTO, ConfigService, EnvPayload } from '../api/services/Config/config.api'
import { ScanService } from '../api/services/Scan/scan.api'
import { QueryKey } from '../api/QueryKey'
import { useAppDispatch, useAppSelector } from '../redux/services/store'
import { setConfig, setEnv } from '../redux/services/Config/config.slice'
import FileSystemPage from './filesystem/filesystem.page'

const ConfigurationPage: React.FC = () => {
  const { config, env } = useAppSelector(s => s.config)
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()

  // --- local state hooks (unchanged) ---
  const [sourcePath, setSourcePath]       = useState(config?.sourcePath  || '')
  const [aiCallDepth, setAiCallDepth]     = useState(config?.aiCallDepth  || 1)
  const [logLevel, setLogLevel]           = useState(config?.logLevel      || 'info')
  const [ruleset, setRuleset]             = useState<string | null>(config?.ruleset || null)
  const [envFile, setEnvFile]             = useState<string | null>(config?.envFile || null)
  const [isFsModalOpen, setIsFsModalOpen] = useState(false)

  const [llmProvider, setLlmProviderState]     = useState<string | null>(env?.LINTAI_LLM_PROVIDER       || null)
  const [maxLlmCost, setMaxLlmCostState]       = useState<number | null>(env?.LINTAI_MAX_LLM_COST_USD   || null)
  const [maxLlmRequests, setMaxLlmRequestsState] = useState<number | null>(env?.LINTAI_MAX_LLM_REQUESTS || null)
  const [maxLlmTokens, setMaxLlmTokensState]   = useState<number | null>(env?.LINTAI_MAX_LLM_TOKENS    || null)
  const [llmApiVersion, setLlmApiVersionState] = useState<string | null>(env?.LLM_API_VERSION          || null)
  const [llmEndpointUrl, setLlmEndpointUrlState] = useState<string | null>(env?.LLM_ENDPOINT_URL        || null)
  const [llmModelName, setLlmModelNameState]   = useState<string | null>(env?.LLM_MODEL_NAME           || null)

  // Single API key field that maps to the selected provider
  const [apiKey, setApiKey] = useState<string>('')
  const [secretsStatus, setSecretsStatus] = useState<any>({})

  // Show/hide advanced settings
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false)





  const {
      data: configRes,
      isFetching: isFetchingConfig,
  } = useQuery({
      queryKey: [QueryKey.CONFIG],
      queryFn: async () => {
          const res = await ConfigService.getConfig()
          dispatch(setConfig({
              aiCallDepth: res.ai_call_depth,
              envFile: res.env_file,
              logLevel: res.log_level,
              ruleset: res.ruleset,
              sourcePath: res.source_path
          }))
          console.log(res, 'config fetched')
          return res
      },
  })

  const {
      data: envRes,
      isFetching: isFetchingEnv,
  } = useQuery({
      queryKey: [QueryKey.BACKENDENV],
      queryFn: async () => {
          const res = await ConfigService.getEnv()
          dispatch(setEnv({
              LINTAI_MAX_LLM_TOKENS: res.LINTAI_MAX_LLM_TOKENS,
              LINTAI_MAX_LLM_COST_USD: res.LINTAI_MAX_LLM_COST_USD,
              LINTAI_MAX_LLM_REQUESTS: res.LINTAI_MAX_LLM_REQUESTS,
              LINTAI_LLM_PROVIDER: res.LINTAI_LLM_PROVIDER,
              LLM_ENDPOINT_URL: res.LLM_ENDPOINT_URL,
              LLM_API_VERSION: res.LLM_API_VERSION,
              LLM_MODEL_NAME: res.LLM_MODEL_NAME,
          }))
          console.log(res, 'env fetched')
          return res
      },
      initialData: [],
      refetchOnMount: true,
      refetchOnWindowFocus: false,
  })

  const {
      data: secretsStatusRes,
      isFetching: isFetchingSecrets,
  } = useQuery({
      queryKey: ['SECRETS_STATUS'],
      queryFn: async () => {
          const res = await ConfigService.getSecretsStatus()
          setSecretsStatus(res)
          return res
      },
      refetchOnMount: true,
      refetchOnWindowFocus: false,
  })

  const { mutate: updateConfig, isPending: isUpdatingConfig } = useMutation({
      mutationFn: async (config: ConfigDTO) => {
          return await ConfigService.updateConfig(config)
      },
      onSuccess: () => {
          alert('Configuration updated successfully!')
          queryClient.invalidateQueries({queryKey:[QueryKey.CONFIG]})
          dispatch(setConfig(config))
      },
      onError: (error: any) => {
          alert(error.message || 'Failed to update configuration.')
      },
  })

  const { mutate: updateEnv, isPending: isUpdatingEnv } = useMutation({
      mutationFn: async (envPayload: EnvPayload) => {
          return await ConfigService.updateEnv(envPayload)

      },
      onSuccess: (res) => {
          // dispatch(setConfig({
          //     aiCallDepth: res.ai_call_depth,
          //     envFile: res.env_file,
          //     logLevel: res.log_level,
          //     ruleset: res.ruleset,
          //     sourcePath: res.source_path
          // }))

          queryClient.invalidateQueries({queryKey:[QueryKey.BACKENDENV]})
          // alert('Environment updated successfully!')

      },
      onError: (error: any) => {
          alert(error.message || 'Failed to update environment.')
      },
  })

  const { mutate: updateSecrets, isPending: isUpdatingSecrets } = useMutation({
      mutationFn: async (secrets: any) => {
          return await ConfigService.updateSecrets(secrets)
      },
      onSuccess: () => {
          alert('API keys updated successfully!')
          // Clear the API key field after successful save
          setApiKey('')
          // Refresh secrets status
          queryClient.invalidateQueries({queryKey:['SECRETS_STATUS']})
      },
      onError: (error: any) => {
          alert(error.message || 'Failed to update API keys.')
      },
  })

  const { mutate: clearHistory, isPending: isClearingHistory } = useMutation({
      mutationFn: async () => {
          return await ScanService.clearHistory()
      },
      onSuccess: () => {
          alert('All scan history and results have been cleared successfully!')
          // Refresh all history-related queries
          queryClient.invalidateQueries({ queryKey: ['runs'] })
          queryClient.invalidateQueries({ queryKey: ['scan_history'] })
          queryClient.invalidateQueries({ queryKey: ['inventory_history'] })
          queryClient.invalidateQueries({ queryKey: ['history'] })
          queryClient.invalidateQueries({ queryKey: [QueryKey.JOB + 'history'] })
          queryClient.invalidateQueries({ queryKey: ['inventory-history'] })
      },
      onError: (error: any) => {
          alert(error.message || 'Failed to clear history.')
      },
  })

  const handleSave = () => {
    const configDto: ConfigDTO = {
      source_path: sourcePath,
      ai_call_depth: aiCallDepth,
      log_level: logLevel,
      ruleset,
      env_file: envFile,
    }

    const envPayload: EnvPayload = {
      LINTAI_LLM_PROVIDER: llmProvider,
      LINTAI_MAX_LLM_COST_USD: maxLlmCost,
      LINTAI_MAX_LLM_REQUESTS: maxLlmRequests,
      LINTAI_MAX_LLM_TOKENS: maxLlmTokens,
      LLM_API_VERSION: llmApiVersion,
      LLM_ENDPOINT_URL: llmEndpointUrl,
      LLM_MODEL_NAME: llmModelName,
    }

    // Map the single API key to the correct provider-specific field
    const secretsPayload: any = {}
    if (apiKey && llmProvider) {
      switch (llmProvider.toLowerCase()) {
        case 'openai':
          secretsPayload.OPENAI_API_KEY = apiKey
          break
        case 'azure':
          secretsPayload.AZURE_OPENAI_API_KEY = apiKey
          break
        case 'anthropic':
        case 'claude':
          secretsPayload.ANTHROPIC_API_KEY = apiKey
          break
        case 'gemini':
        case 'google':
          secretsPayload.GOOGLE_API_KEY = apiKey
          break
        case 'cohere':
          secretsPayload.COHERE_API_KEY = apiKey
          break
        default:
          // For other providers or generic case
          secretsPayload.LLM_API_KEY = apiKey
          break
      }
    }

    updateConfig(configDto)
    updateEnv(envPayload)

    // Only update secrets if any API keys are provided
    if (Object.keys(secretsPayload).length > 0) {
      updateSecrets(secretsPayload)
    }
  }

  const handleFolderSelection = (path: string) => {
    setSourcePath(path)
    setIsFsModalOpen(false)
  }

  const handleClearHistory = () => {
      if (window.confirm(
          'Are you sure you want to clear ALL scan history and results? This action cannot be undone.\n\n' +
          'This will remove:\n' +
          '• All scan and inventory history\n' +
          '• All result files and reports\n' +
          '• File index\n\n' +
          'Your configuration and API keys will be preserved.'
      )) {
          clearHistory()
      }
  }

  return (
    <div className=" max-w-4xl mx-60  mt-20">
      {/* Page Title */}
      <div className='flex justify-between items-center text-center border-b pb-3 mb-8'>

      <h2 className="text-lg font-semibold self-center  ">Settings</h2>


      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-primary text-white rounded disabled:opacity-50"
          disabled={isUpdatingConfig || isUpdatingEnv || isUpdatingSecrets}
        >
          {isUpdatingConfig || isUpdatingEnv || isUpdatingSecrets ? 'Saving...' : 'Save'}
        </button>
      </div>
      </div>

      {/* Essential Configuration Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold border-b pb-2 mb-4">Essential Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Path */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Source Path</label>
            <input
              type="text"
              value={sourcePath}
              onClick={() => setIsFsModalOpen(true)}
              onChange={e => setSourcePath(e.target.value)}
              placeholder="Click to select folder to scan"
              className="w-full border rounded px-2 py-1 cursor-pointer"
            />
          </div>

          {/* LLM Provider */}
          <div>
            <label className="block text-sm font-medium mb-1">LLM Provider</label>
            <select
              value={llmProvider || ''}
              onChange={e => {
                const newProvider = e.target.value || null
                setLlmProviderState(newProvider)

                // Auto-set default model names based on provider
                if (newProvider === 'anthropic') {
                  setLlmModelNameState('claude-3-sonnet-20240229')
                } else if (newProvider === 'gemini') {
                  setLlmModelNameState('gemini-pro')
                } else if (newProvider === 'openai') {
                  setLlmModelNameState('gpt-4')
                } else if (newProvider === 'azure') {
                  setLlmModelNameState('gpt-4')
                } else if (newProvider === 'cohere') {
                  setLlmModelNameState('command-r')
                }

                // Clear endpoint URL for providers that don't need it
                if (newProvider === 'anthropic' || newProvider === 'gemini' || newProvider === 'openai' || newProvider === 'cohere') {
                  setLlmEndpointUrlState(null)
                }
              }}
              className="w-full border rounded px-2 py-1"
            >
              <option value="">Select Provider</option>
              <option value="openai">OpenAI</option>
              <option value="azure">Azure OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="gemini">Google Gemini</option>
              <option value="cohere">Cohere</option>
              <option value="dummy">Dummy (for testing)</option>
            </select>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium mb-1">
              API Key
              {llmProvider && (
                <span className="text-xs text-gray-500 ml-1">
                  ({llmProvider === 'azure' ? 'Azure OpenAI' :
                    llmProvider === 'anthropic' ? 'Anthropic Claude' :
                    llmProvider === 'gemini' ? 'Google Gemini' :
                    llmProvider === 'openai' ? 'OpenAI' :
                    llmProvider === 'cohere' ? 'Cohere' :
                    llmProvider})
                </span>
              )}
              {(() => {
                const getKeyForProvider = (provider: string) => {
                  switch (provider?.toLowerCase()) {
                    case 'openai': return 'OPENAI_API_KEY'
                    case 'azure': return 'AZURE_OPENAI_API_KEY'
                    case 'anthropic': case 'claude': return 'ANTHROPIC_API_KEY'
                    case 'gemini': case 'google': return 'GOOGLE_API_KEY'
                    case 'cohere': return 'COHERE_API_KEY'
                    default: return 'LLM_API_KEY'
                  }
                }
                const keyName = getKeyForProvider(llmProvider || '')
                const isConfigured = secretsStatus[keyName]
                return isConfigured ? (
                  <span className="text-xs text-green-600 ml-2">✓ configured</span>
                ) : null
              })()}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={(() => {
                if (!llmProvider || llmProvider === 'dummy') {
                  return 'Select a provider first'
                }
                const getKeyForProvider = (provider: string) => {
                  switch (provider?.toLowerCase()) {
                    case 'openai': return 'OPENAI_API_KEY'
                    case 'azure': return 'AZURE_OPENAI_API_KEY'
                    case 'anthropic': case 'claude': return 'ANTHROPIC_API_KEY'
                    case 'gemini': case 'google': return 'GOOGLE_API_KEY'
                    case 'cohere': return 'COHERE_API_KEY'
                    default: return 'LLM_API_KEY'
                  }
                }
                const keyName = getKeyForProvider(llmProvider || '')
                const isConfigured = secretsStatus[keyName]

                if (isConfigured) {
                  return `API key configured. Enter new key to update.`
                } else {
                  return `Enter your ${llmProvider} API key`
                }
              })()}
              disabled={!llmProvider || llmProvider === 'dummy'}
              className="w-full border rounded px-2 py-1 disabled:bg-gray-100"
            />
          </div>

          {/* Model Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Model Name
              <span className="text-xs text-gray-500 ml-1">(choose model variant)</span>
            </label>
            <input
              type="text"
              value={llmModelName || ''}
              onChange={e => setLlmModelNameState(e.target.value || null)}
              placeholder={
                llmProvider === 'openai' ? 'gpt-4, gpt-3.5-turbo' :
                llmProvider === 'azure' ? 'your-deployment-name' :
                llmProvider === 'anthropic' ? 'claude-3-sonnet-20240229, claude-3-opus-20240229' :
                llmProvider === 'gemini' ? 'gemini-pro, gemini-1.5-pro' :
                llmProvider === 'cohere' ? 'command-r, command-r-plus' :
                'Select a provider first'
              }
              disabled={!llmProvider || llmProvider === 'dummy'}
              className="w-full border rounded px-2 py-1 disabled:bg-gray-100"
            />
          </div>

          {/* Endpoint URL - only show for Azure or when manually needed */}
          {llmProvider === 'azure' && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Azure Endpoint URL
                <span className="text-xs text-red-500 ml-1">(required for Azure)</span>
              </label>
              <input
                type="text"
                value={llmEndpointUrl || ''}
                onChange={e => setLlmEndpointUrlState(e.target.value || null)}
                placeholder="https://your-resource.openai.azure.com"
                className="w-full border rounded px-2 py-1"
              />
            </div>
          )}

          {/* AI Call Depth */}
          <div>
            <label className="block text-sm font-medium mb-1">
              AI Call Depth
              <span className="text-xs text-gray-500 ml-1">(how deep to trace AI calls)</span>
            </label>
            <input
              type="number"
              value={aiCallDepth}
              onChange={e => setAiCallDepth(Number(e.target.value))}
              min="0"
              max="10"
              className="w-full border rounded px-2 py-1"
            />
          </div>

          {/* Budget Controls */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Max Cost (USD)
              <span className="text-xs text-gray-500 ml-1">(safety limit)</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={maxLlmCost || ''}
              onChange={e => setMaxLlmCostState(e.target.value ? Number(e.target.value) : null)}
              placeholder="3.50"
              className="w-full border rounded px-2 py-1"
            />
          </div>
        </div>
      </section>

      {/* Advanced Settings */}
      <section className="mb-8">
        <div className="border-b pb-2 mb-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-lg font-semibold hover:text-primary"
          >
            <span className="mr-2">{showAdvanced ? '▼' : '▶'}</span>
            Advanced Settings
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Log Level */}
              <div>
                <label className="block text-sm font-medium mb-1">Log Level</label>
                <select
                  value={logLevel}
                  onChange={e => setLogLevel(e.target.value)}
                  className="w-full border rounded px-2 py-1"
                >
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                  <option value="error">Error</option>
                </select>
              </div>

              {/* Max Requests */}
              <div>
                <label className="block text-sm font-medium mb-1">Max LLM Requests</label>
                <input
                  type="number"
                  value={maxLlmRequests || ''}
                  onChange={e => setMaxLlmRequestsState(e.target.value ? Number(e.target.value) : null)}
                  placeholder="10"
                  className="w-full border rounded px-2 py-1"
                />
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm font-medium mb-1">Max LLM Tokens</label>
                <input
                  type="number"
                  value={maxLlmTokens || ''}
                  onChange={e => setMaxLlmTokensState(e.target.value ? Number(e.target.value) : null)}
                  placeholder="10000"
                  className="w-full border rounded px-2 py-1"
                />
              </div>

              {/* API Version (for Azure) */}
              {llmProvider === 'azure' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    API Version
                    <span className="text-xs text-gray-500 ml-1">(Azure API version)</span>
                  </label>
                  <input
                    type="text"
                    value={llmApiVersion || ''}
                    onChange={e => setLlmApiVersionState(e.target.value || null)}
                    placeholder="2024-02-15-preview"
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
              )}

              {/* Custom Endpoint URL for other providers */}
              {llmProvider && llmProvider !== 'azure' && llmProvider !== 'dummy' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Custom Endpoint URL
                    <span className="text-xs text-gray-500 ml-1">(optional, leave empty for default)</span>
                  </label>
                  <input
                    type="text"
                    value={llmEndpointUrl || ''}
                    onChange={e => setLlmEndpointUrlState(e.target.value || null)}
                    placeholder={
                      llmProvider === 'openai' ? 'https://api.openai.com/v1 (default)' :
                      'Custom endpoint URL'
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
              )}

              {/* Ruleset */}
              <div>
                <label className="block text-sm font-medium mb-1">Custom Ruleset</label>
                <input
                  type="text"
                  value={ruleset || ''}
                  onChange={e => setRuleset(e.target.value || null)}
                  placeholder="optional custom rules"
                  className="w-full border rounded px-2 py-1"
                />
              </div>

              {/* Environment File */}
              <div>
                <label className="block text-sm font-medium mb-1">Environment File</label>
                <input
                  type="text"
                  value={envFile || ''}
                  onChange={e => setEnvFile(e.target.value || null)}
                  placeholder=".env"
                  className="w-full border rounded px-2 py-1"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Danger Zone Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold border-b pb-2 mb-4 text-red-800">Danger Zone</h2>

        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <h3 className="text-md font-medium text-red-800 mb-2">Clear All History</h3>
          <p className="text-sm text-red-700 mb-3">
            Clear all scan history and results. This will remove all previous scans, inventory data, and reports,
            but will preserve your configuration and API keys.
          </p>
          <button
            onClick={handleClearHistory}
            disabled={isClearingHistory}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClearingHistory ? 'Clearing...' : 'Clear All History'}
          </button>
        </div>
      </section>

      {/* Save Button */}


      {/* File‐System Modal */}
      {isFsModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
          <div className="w-3/4 h-3/4 bg-white rounded-lg shadow-lg overflow-hidden">
            <FileSystemPage
              setIsModalOpen={setIsFsModalOpen}
              handleScan={handleFolderSelection}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ConfigurationPage
