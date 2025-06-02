import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfigDTO, ConfigService, EnvPayload } from '../api/services/Config/config.api'
import { QueryKey } from '../api/QueryKey'
import { useAppDispatch, useAppSelector } from '../redux/services/store'
import { setConfig, setEnv, setLlmProvider, setMaxLlmCost, setMaxLlmRequests, setMaxLlmTokens, setLlmApiVersion, setLlmEndpointUrl, setLlmModelName } from '../redux/services/Config/config.slice'


const ConfigurationPage: React.FC = () => {
    const { config, env } = useAppSelector(state => state.config)
    const dispatch = useAppDispatch()

    // Config state
    const [sourcePath, setSourcePath] = useState<string>(config?.sourcePath || '')
    const [aiCallDepth, setAiCallDepth] = useState<number>(config?.aiCallDepth || 1)
    const [logLevel, setLogLevel] = useState<string>(config?.logLevel || 'info')
    const [ruleset, setRuleset] = useState<string | null>(config?.ruleset || null)
    const [envFile, setEnvFile] = useState<string | null>(config?.envFile || null)

    // Environment state
    const [llmProvider, setLlmProviderState] = useState<string | null>(env?.LINTAI_LLM_PROVIDER || null)
    const [maxLlmCost, setMaxLlmCostState] = useState<number | null>(env?.LINTAI_MAX_LLM_COST_USD || null)
    const [maxLlmRequests, setMaxLlmRequestsState] = useState<number | null>(env?.LINTAI_MAX_LLM_REQUESTS || null)
    const [maxLlmTokens, setMaxLlmTokensState] = useState<number | null>(env?.LINTAI_MAX_LLM_TOKENS || null)
    const [llmApiVersion, setLlmApiVersionState] = useState<string | null>(env?.LLM_API_VERSION || null)
    const [llmEndpointUrl, setLlmEndpointUrlState] = useState<string | null>(env?.LLM_ENDPOINT_URL || null)
    const [llmModelName, setLlmModelNameState] = useState<string | null>(env?.LLM_MODEL_NAME || null)


    const queryClient=useQueryClient()

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
        const config: ConfigDTO = {
            source_path: sourcePath,
            ai_call_depth: aiCallDepth,
            log_level: logLevel,
            ruleset,
            env_file: envFile,
        }

        const envPayload: EnvPayload = {
            LINTAI_MAX_LLM_TOKENS: maxLlmTokens,
            LINTAI_MAX_LLM_COST_USD: maxLlmCost,
            LINTAI_MAX_LLM_REQUESTS: maxLlmRequests,
            LINTAI_LLM_PROVIDER: llmProvider,
            LLM_ENDPOINT_URL: llmEndpointUrl,
            LLM_API_VERSION: llmApiVersion,
            LLM_MODEL_NAME: llmModelName,
        }

    

        updateConfig(config)
        updateEnv(envPayload)
    }

    return (
        <div className="p-6 sm:ml-50">
            {/* Config Section */}
            <h2 className="text-lg font-bold mb-4">Configuration</h2>
            <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Source Path</label>
                <input
                    type="text"
                    value={sourcePath}
                    onChange={(e) => setSourcePath(e.target.value)}
                    className="w-full border rounded px-2 py-1"
                />
            </div>
            <div className="mb-4">
                <label className="block text-sm font-medium mb-1">AI Call Depth</label>
                <input
                    type="number"
                    value={aiCallDepth}
                    onChange={(e) => setAiCallDepth(Number(e.target.value))}
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
                <label className="block text-sm font-medium mb-1">Ruleset</label>
                <input
                    type="text"
                    value={ruleset || ''}
                    onChange={(e) => setRuleset(e.target.value || null)}
                    className="w-full border rounded px-2 py-1"
                />
            </div>
            <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Environment File</label>
                <input
                    type="text"
                    value={envFile || ''}
                    onChange={(e) => setEnvFile(e.target.value || null)}
                    className="w-full border rounded px-2 py-1"
                />
            </div>

            {/* Environment Section */}
            <h2 className="text-lg font-bold mb-4">Environment</h2>
            <div className="mb-4">
                <label className="block text-sm font-medium mb-1">LLM Provider</label>
                <input
                    type="text"
                    value={llmProvider || ''}
                    onChange={(e) => setLlmProviderState(e.target.value || null)}
                    className="w-full border rounded px-2 py-1"
                />
            </div>
            <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Max LLM Cost (USD)</label>
                <input
                    type="number"
                    value={maxLlmCost || ''}
                    onChange={(e) => setMaxLlmCostState(e.target.value ? Number(e.target.value) : null)}
                    className="w-full border rounded px-2 py-1"
                />
            </div>
            <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Max LLM Requests</label>
                <input
                    type="number"
                    value={maxLlmRequests || ''}
                    onChange={(e) => setMaxLlmRequestsState(e.target.value ? Number(e.target.value) : null)}
                    className="w-full border rounded px-2 py-1"
                />
            </div>
            <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Max LLM Tokens</label>
                <input
                    type="number"
                    value={maxLlmTokens || ''}
                    onChange={(e) => setMaxLlmTokensState(e.target.value ? Number(e.target.value) : null)}
                    className="w-full border rounded px-2 py-1"
                />
            </div>
            <div className="mb-4">
                <label className="block text-sm font-medium mb-1">LLM API Version</label>
                <input
                    type="text"
                    value={llmApiVersion || ''}
                    onChange={(e) => setLlmApiVersionState(e.target.value || null)}
                    className="w-full border rounded px-2 py-1"
                />
            </div>
            <div className="mb-4">
                <label className="block text-sm font-medium mb-1">LLM Endpoint URL</label>
                <input
                    type="text"
                    value={llmEndpointUrl || ''}
                    onChange={(e) => setLlmEndpointUrlState(e.target.value || null)}
                    className="w-full border rounded px-2 py-1"
                />
            </div>
            <div className="mb-4">
                <label className="block text-sm font-medium mb-1">LLM Model Name</label>
                <input
                    type="text"
                    value={llmModelName || ''}
                    onChange={(e) => setLlmModelNameState(e.target.value || null)}
                    className="w-full border rounded px-2 py-1"
                />
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-primary text-white rounded"
                    disabled={isUpdatingConfig || isUpdatingEnv}
                >
                    {isUpdatingConfig || isUpdatingEnv ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    )
}

export default ConfigurationPage
