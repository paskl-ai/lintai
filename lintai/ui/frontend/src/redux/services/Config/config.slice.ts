import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface ConfigState {
    aiCallDepth: number
    envFile: string | null
    logLevel: string
    ruleset: string | null
    sourcePath: string
}

interface EnvState {
    LINTAI_MAX_LLM_TOKENS?: number | null
    LINTAI_MAX_LLM_COST_USD?: number | null
    LINTAI_MAX_LLM_REQUESTS?: number | null
    LINTAI_LLM_PROVIDER?: string | null
    LLM_ENDPOINT_URL?: string | null
    LLM_API_VERSION?: string | null
    LLM_MODEL_NAME?: string | null
}

const initialConfigState: ConfigState = {
    aiCallDepth: 2,
    envFile: null,
    logLevel: 'INFO',
    ruleset: null,
    sourcePath: '.',
}

const initialEnvState: EnvState = {
    LINTAI_MAX_LLM_TOKENS: null,
    LINTAI_MAX_LLM_COST_USD: null,
    LINTAI_MAX_LLM_REQUESTS: null,
    LINTAI_LLM_PROVIDER: null,
    LLM_ENDPOINT_URL: null,
    LLM_API_VERSION: null,
    LLM_MODEL_NAME: null,
}

const configSlice = createSlice({
    name: 'config',
    initialState: {
        config: initialConfigState,
        env: initialEnvState,
    },
    reducers: {
        // Config reducers
        setAiCallDepth(state, action: PayloadAction<number>) {
            state.config.aiCallDepth = action.payload
        },
        setEnvFile(state, action: PayloadAction<string | null>) {
            state.config.envFile = action.payload
        },
        setLogLevel(state, action: PayloadAction<string>) {
            state.config.logLevel = action.payload
        },
        setRuleset(state, action: PayloadAction<string | null>) {
            state.config.ruleset = action.payload
        },
        setSourcePath(state, action: PayloadAction<string>) {
            state.config.sourcePath = action.payload
        },
        setConfig(state, action: PayloadAction<ConfigState>) {
            state.config = action.payload
        },

        // Environment reducers
        setEnv(state, action: PayloadAction<EnvState>) {
            state.env = action.payload
        },
        setLlmProvider(state, action: PayloadAction<string | null>) {
            state.env.LINTAI_LLM_PROVIDER = action.payload
        },
        setMaxLlmCost(state, action: PayloadAction<number | null>) {
            state.env.LINTAI_MAX_LLM_COST_USD = action.payload
        },
        setMaxLlmRequests(state, action: PayloadAction<number | null>) {
            state.env.LINTAI_MAX_LLM_REQUESTS = action.payload
        },
        setMaxLlmTokens(state, action: PayloadAction<number | null>) {
            state.env.LINTAI_MAX_LLM_TOKENS = action.payload
        },
        setLlmApiVersion(state, action: PayloadAction<string | null>) {
            state.env.LLM_API_VERSION = action.payload
        },
        setLlmEndpointUrl(state, action: PayloadAction<string | null>) {
            state.env.LLM_ENDPOINT_URL = action.payload
        },
        setLlmModelName(state, action: PayloadAction<string | null>) {
            state.env.LLM_MODEL_NAME = action.payload
        },
    },
})

export const {
    setAiCallDepth,
    setEnvFile,
    setLogLevel,
    setRuleset,
    setSourcePath,
    setConfig,
    setEnv,
    setLlmProvider,
    setMaxLlmCost,
    setMaxLlmRequests,
    setMaxLlmTokens,
    setLlmApiVersion,
    setLlmEndpointUrl,
    setLlmModelName,
} = configSlice.actions
export default configSlice.reducer
