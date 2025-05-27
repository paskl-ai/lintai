import api from '../../Api'

class Scan {
    async getRuns() {
        const response = await api.get('/runs') // Updated endpoint
        return response.data
    }

    async startScan(data: { target: string; options: Record<string, any> }) {
        const response = await api.post('/scan', data) // Updated endpoint
        return response.data
    }

    async getResults(runId: string) {
        const response = await api.get(`/results/${runId}`) // Updated endpoint
        return response.data
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
