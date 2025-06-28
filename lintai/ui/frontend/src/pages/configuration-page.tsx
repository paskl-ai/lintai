import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfigDTO, ConfigService, EnvPayload } from '../api/services/Config/config.api'
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
    }
  

    updateConfig(configDto)
    updateEnv(envPayload)
  }

  const handleFolderSelection = (path: string) => {
    setSourcePath(path)
    setIsFsModalOpen(false)
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
          disabled={isUpdatingConfig || isUpdatingEnv}
        >
          {isUpdatingConfig || isUpdatingEnv ? 'Saving...' : 'Save'}
        </button>
      </div>
      </div>

      {/* Configuration Section */}
      <section className="mb-8">
        <div className="space-y-4">
          {/* Source Path */}
          <div>
            <label className="block text-sm font-medium mb-1">Source Path</label>
            <input
              type="text"
              value={sourcePath}
              onClick={() => setIsFsModalOpen(true)}
              onChange={e => setSourcePath(e.target.value)}
              className="w-full border rounded px-2 py-1"
            />
          </div>

          {/* AI Call Depth */}
          <div>
            <label className="block text-sm font-medium mb-1">AI Call Depth</label>
            <input
              type="number"
              value={aiCallDepth}
              onChange={e => setAiCallDepth(Number(e.target.value))}
              className="w-full border rounded px-2 py-1"
            />
          </div>

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

          {/* Ruleset */}
          <div>
            <label className="block text-sm font-medium mb-1">Ruleset</label>
            <input
              type="text"
              value={ruleset || ''}
              onChange={e => setRuleset(e.target.value || null)}
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
              className="w-full border rounded px-2 py-1"
            />
          </div>
        </div>
      </section>

      {/* Environment Section */}
      <section>
        <h2 className="text-lg font-semibold border-b pb-2 mb-4">Environment</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column */}
          <div>
            <label className="block text-sm font-medium mb-1">LLM Provider</label>
            <input
              type="text"
              value={llmProvider || ''}
              onChange={e => setLlmProviderState(e.target.value || null)}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max LLM Requests</label>
            <input
              type="number"
              value={maxLlmRequests || ''}
              onChange={e => setMaxLlmRequestsState(e.target.value ? Number(e.target.value) : null)}
              className="w-full border rounded px-2 py-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Max LLM Cost (USD)</label>
            <input
              type="number"
              value={maxLlmCost || ''}
              onChange={e => setMaxLlmCostState(e.target.value ? Number(e.target.value) : null)}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">LLM API Version</label>
            <input
              type="text"
              value={llmApiVersion || ''}
              onChange={e => setLlmApiVersionState(e.target.value || null)}
              className="w-full border rounded px-2 py-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Max LLM Tokens</label>
            <input
              type="number"
              value={maxLlmTokens || ''}
              onChange={e => setMaxLlmTokensState(e.target.value ? Number(e.target.value) : null)}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">LLM Model Name</label>
            <input
              type="text"
              value={llmModelName || ''}
              onChange={e => setLlmModelNameState(e.target.value || null)}
              className="w-full border rounded px-2 py-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">LLM Endpoint URL</label>
            <input
              type="text"
              value={llmEndpointUrl || ''}
              onChange={e => setLlmEndpointUrlState(e.target.value || null)}
              className="w-full border rounded px-2 py-1"
            />
          </div>
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
