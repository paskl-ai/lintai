import api from "../../Api"


export interface ConfigDTO {
    source_path: string | null
    ai_call_depth: number | null
    log_level: string | null
    ruleset?: string | null
    env_file?: string | null
}

export interface EnvPayload {
    LINTAI_MAX_LLM_TOKENS?: number | null
    LINTAI_MAX_LLM_COST_USD?: number | null
    LINTAI_MAX_LLM_REQUESTS?: number | null
    LINTAI_LLM_PROVIDER?: string | null
    LLM_ENDPOINT_URL?: string | null
    LLM_API_VERSION?: string | null
    LLM_MODEL_NAME?: string | null
}




export interface SecretPayload {
    LLM_API_KEY?: string
    OPENAI_API_KEY?: string
    AZURE_OPENAI_API_KEY?: string
    ANTHROPIC_API_KEY?: string
    GOOGLE_API_KEY?: string
}

class Config {

async getHealth (){
    const response = await api.get("/api/health");
    return response.data;
};

async getConfig (){
    const response = await api.get("/api/config");
    return response.data;
};

async updateConfig (config: ConfigDTO) {
    const response = await api.post("/api/config", config);
    return response.data;
};

async getEnv () {
    const response = await api.get("/api/env");
    return response.data;
};

async updateEnv (env: EnvPayload){
    await api.post("/api/env", env);
};

async updateSecrets(secrets: SecretPayload){
    await api.post("/api/secrets", secrets);
};

async getRuns  (){
    const response = await api.get("/api/runs");
    return response.data;
};

async startScan (formData: FormData){
    const response = await api.post("/api/scan", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
};

async startInventory (params: {
    path?: string;
    depth?: number;
    log_level?: string;
}){
    const response = await api.post("/api/inventory", null, { params });
    return response.data;
};

async getResults  (runId: string){
    const response = await api.get(`/api/results/${runId}`);
    return response.data;
};

async filterResults (
    runId: string,
    filters: { severity?: string; owasp_id?: string; component?: string }
) {
    const response = await api.get(`/api/results/${runId}/filter`, { params: filters });
    return response.data;
};

async getSubgraph (
    runId: string,
    node: string,
    depth: number
) {
    const response = await api.get(`/inventory/${runId}/subgraph`, {
        params: { node, depth },
    });
    return response.data;
};

}
export const ConfigService = new Config()
