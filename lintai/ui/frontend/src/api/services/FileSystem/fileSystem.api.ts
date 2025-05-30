import api from '../../Api'

class FileSystem {
  async listDir(path: string | null = null,query:string|null) {
    const response = await api.get('/fs', {
      params: { path:query?query:path }, // Pass the path as a query parameter
    })
    return response.data
  }

  async listDirRoot(path: string | null = null,query:string|null) {
    const response = await api.get('/fsroot', {
      params: { path:query?query:path }, // Pass the path as a query parameter
    })
    return response.data
  }
}



export const FileSystemService = new FileSystem()
