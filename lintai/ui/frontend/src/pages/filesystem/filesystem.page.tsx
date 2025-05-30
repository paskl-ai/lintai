import React, { useEffect, useState } from 'react'
import { FileSystemService } from '../../api/services/FileSystem/fileSystem.api'
import { debounce } from 'lodash'
import CommonButton from '../../components/buttons/CommonButton'

interface FileItem {
  name: string
  path: string
  dir: boolean
}

interface FileSystemPageProps {
    handleScan: (path: string) => void
  setIsModalOpen: (isOpen: boolean) => void
}

const FileSystemPage: React.FC<FileSystemPageProps> = ({ handleScan ,setIsModalOpen}) => {
  const [currentPath, setCurrentPath] = useState<string>('')
  const [items, setItems] = useState<FileItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [localSearchQuery, setLocalSearchQuery] = useState<string>('')

  const fetchDirectory = async (path: string | null = null, query: string = '') => {
    setLoading(true)
    try {
      const response = await FileSystemService.listDir(path, query)
      setCurrentPath(response.cwd)
      setItems(response.items)
    } catch (error) {
      console.error('Error fetching directory:', error)
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => {
    if (currentPath) {
      const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/'
      fetchDirectory(parentPath)
    }
  }

  const handleSelect = () => {
    handleScan(currentPath)
    console.log('Selected Path:', currentPath)
    setIsModalOpen(false)
  }

  useEffect(() => {
    fetchDirectory() // Fetch the root directory when the modal opens
  }, [])

  const debouncedSearch = debounce((query: string) => {
    fetchDirectory(currentPath, query)
  }, 300)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setLocalSearchQuery(query)
    debouncedSearch(query)
  }

  const handleItemClick = (item: FileItem) => {
    if (item.dir) {
      fetchDirectory(item.path) // Fetch the contents of the clicked directory
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-primary/70  flex justify-center items-center z-50">
        <div className="bg-white w-3/4 h-3/4 rounded-lg shadow-lg overflow-hidden flex flex-col">
          <div className="flex justify-between items-center p-4 border-b">
            <p className="text-gray-600">Current Path: {currentPath || '/'}</p>
            <div className="flex space-x-4">
           
              <button
                className="text-red-500 font-bold"
                onClick={() => setIsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
          <div className="p-4 border-b">
            <input
              type="text"
              placeholder="Search folders..."
              className="w-full px-4 py-2 border rounded"
              value={localSearchQuery}
              onChange={handleSearchChange}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              {currentPath && currentPath !== '/' && (
                <button
                  className="text-blue-700 underline"
                  onClick={goBack}
                >
                  Go Back
                </button>
              )}
            </div>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.path}
                    className={`flex items-center space-x-2 cursor-pointer ${
                      item.dir ? 'text-primary' : 'text-gray-800'
                    }`}
                    onClick={() => handleItemClick(item)}
                  >
                    <span>
                        {item.dir
                        ? '📁'
                        : item.name.endsWith('.txt')
                        ? '📄'
                        : item.name.endsWith('.jpg') || item.name.endsWith('.png') || item.name.endsWith('.gif')
                        ? '🖼️'
                        : item.name.endsWith('.pdf')
                        ? '📑'
                        : item.name.endsWith('.js') || item.name.endsWith('.ts') || item.name.endsWith('.py') || item.name.endsWith('.jsx') || item.name.endsWith('.tsx')
                        ? '💻'
                        : item.name.endsWith('.zip') || item.name.endsWith('.rar') || item.name.endsWith('.tar')
                        ? '🗜️'
                        : '📦'}
                    </span>
                    <span>{item.name}</span>
                  </li>
                ))}
              </ul>
            )}
             
          </div>
          <CommonButton
                            className="bg-primary text-white px-4 py-2 rounded flex items-center self-end m-3"
                            onClick={handleSelect}
              >
                Select
              </CommonButton>
        </div>
      </div>
    </>
  )
}

export default FileSystemPage
