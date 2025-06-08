import api from "../../Api"

export interface scanInventoryDTO {path: string, depth?: number, logLevel?: string}
export interface startScanDTO {path: string, depth?: number, logLevel?: string}
class Scan {
    async getRuns() {
        const response = await api.get('/api/runs') // Updated endpoint
        return response.data
    }

    async startScan(body: startScanDTO, files?: File[]) {
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
    
        const response = await api.post(`/api/scan${query}`, formData);
        return response.data;
    }
    

    async scanInventory(body:scanInventoryDTO) {
        const params = {
            path:body.path,
            depth:body.depth,
            log_level: body.logLevel,
        }
        const response = await api.post('/api/inventory', null, { params }) // Updated endpoint
        return response.data
    }

    async findPath(path: string) {
        const params = { path }
        const response = await api.get('/api/fs', { params }) // Updated endpoint
        return response.data
    }

    async getResults(runId: string) {
        const response = await api.get(`/api/results/${runId}`) // Updated endpoint
        return response.data
    }

    async getLastResults() {
        const response = await api.get(`/api/last-result`) // Updated endpoint
        return response.data
    }

    async getHistory() {
        const response = await api.get('/api/history'); // Updated endpoint for history
        return response.data.map((item: any) => ({
            type: item.type,
            date: item.date,
            files: item.files,
            errors: item.errors,
            report: item.report,
        }));
    }

    async stopScan(runId: string) {
        // No equivalent endpoint provided for stopping a scan
        throw new Error('stopScan endpoint is not defined in the provided API list.')
    }

    async deleteRun(runId: string) {
        // No equivalent endpoint provided for deleting a run
        throw new Error('deleteRun endpoint is not defined in the provided API list.')
    }
}

export const ScanService = new Scan()
