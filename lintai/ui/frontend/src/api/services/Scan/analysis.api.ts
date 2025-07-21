import api from "../../Api"
import {
  FindingsJobResult,
  CatalogJobResult,
  LastAnalysisResult,
  AnalysisType,
  JobResult,
  FindingsReport,
  CatalogReport
} from "../types"

export interface catalogAiDTO {path: string, depth?: number, logLevel?: string}
export interface findIssuesDTO {path: string, depth?: number, logLevel?: string}
class Analysis {
    async getRuns() {
        const response = await api.get('/api/runs')
        return response.data
    }

    async findIssues(body: findIssuesDTO, files?: File[]): Promise<JobResult> {
        const formData = new FormData();

        if (files && files.length > 0) {
            files.forEach((file) => {
                formData.append('files', file); // files are in form data
            });
        }

        if (body.depth !== undefined) {
            formData.append('depth', body.depth.toString());
        }

        if (body.logLevel) {
            formData.append('log_level', body.logLevel);
        }

        const query = body?.path
            ? `?path=${encodeURIComponent(body?.path)}`
            : '';

        const response = await api.post(`/api/find-issues${query}`, formData);
        return response.data;
    }


    async catalogAi(body:catalogAiDTO): Promise<JobResult> {
        const params = {
            path:body.path,
            depth:body.depth,
            log_level: body.logLevel,
        }
        const response = await api.post('/api/catalog-ai', null, { params })
        return response.data
    }

    async findPath(path: string) {
        const params = { path }
        const response = await api.get('/api/fs', { params }) // Updated endpoint
        return response.data
    }

    async getResults(runId: string): Promise<FindingsJobResult | CatalogJobResult> {
        const response = await api.get(`/api/results/${runId}`)
        return response.data
    }

    async getLastResults(): Promise<LastAnalysisResult> {
        const response = await api.get(`/api/last-result`)
        return response.data
    }

    async getLastResultsByType(type: AnalysisType): Promise<LastAnalysisResult> {
        const response = await api.get(`/api/last-result/${type}`)
        return response.data
    }

    async getHistory(): Promise<LastAnalysisResult[]> {
        const response = await api.get('/api/history');
        return response.data.map((item: any) => ({
            type: item.type,
            date: item.date,
            analyzed_path: item.analyzed_path,
            errors: item.errors,
            report: item.report,
            run:item.run
        }));
    }

    async getFindingsHistory(params?: {
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<{
        items: any[];
        total: number;
        page: number;
        limit: number;
        pages: number;
    }> {
        const response = await api.get('/api/history/findings', { params });
        return response.data;
    }

    async getCatalogHistory(params?: { page?: number; limit?: number; search?: string }) {
        const response = await api.get('/api/history/catalog', { params });
        return response.data;
    }

    async clearHistory(): Promise<void> {
        await api.delete('/api/history/clear');
    }

    async stopAnalysis(runId: string) {
        // No equivalent endpoint provided for stopping an analysis
        throw new Error('stopAnalysis endpoint is not defined in the provided API list.')
    }

    async deleteRun(runId: string) {
        // No equivalent endpoint provided for deleting a run
        throw new Error('deleteRun endpoint is not defined in the provided API list.')
    }
}

export const AnalysisService = new Analysis()
