import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ToastContainer, toast } from 'react-toastify'
import { scanInventoryDTO, ScanService } from '../../api/services/Scan/scan.api';
import FileSystemPage from '../filesystem/filesystem.page';
import ConfigurationInfo from '../../components/configurationInfo/ConfigurationInfo';
import { startJob } from '../../redux/services/ServerStatus/server.status.slice';
import { useAppSelector, useAppDispatch } from '../../redux/services/store';
import { useLocation, useNavigate } from 'react-router';
import { StatCard } from '../../components/stateCard/StateCard';
import { useJobManager } from '../../hooks/useJobManager';

// ------------------------------------------------------------------
// MOCK DATA & SERVICES (to make the component self-contained)
// ------------------------------------------------------------------



const QueryKey = { JOB: 'JOB' };

// Mocking local components
const CommonButton = ({ children, ...props }) => <button {...props}>{children}</button>;


// ------------------------------------------------------------------
// ICONS & HELPERS
// ------------------------------------------------------------------
const FiFolder = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>;
const FiFileText = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
const FiChevronDown = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>;
const FiChevronRight = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>;
const FiSearch = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;

const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const strMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${month} ${day}, ${year} ${hours}:${strMinutes} ${ampm}`;
};


// ------------------------------------------------------------------
// TYPES
// ------------------------------------------------------------------
interface InventoryRecord {
  file_path: string;
  frameworks: string[];
  components: {
    component_type: string;
    name: string;
    location: string;
    code_snippet: string;
    call_chain: string[];
    relationships: {
      target_name: string;
      type: string;
    }[];
  }[];
}

interface GroupedInventoryItem {
  type: 'folder' | 'file';
  name: string;
  path: string;
  frameworks?: string[];
  components?: any[];
  children?: GroupedInventoryItem[];
}

// ------------------------------------------------------------------
// HELPER COMPONENTS
// ------------------------------------------------------------------


const InventoryRow = ({ item, level = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const navigate = useNavigate();

    const isFolder = item.type === 'folder';
    const handleViewScan = (e) => {
        // e.stopPropagation();
        // toast.info(`Navigating to inventory details for ${item.name}`);
        navigate(`/inventory/details/${encodeURIComponent(item.path)}`, { state: item });
    }

    return (
        <div className="text-sm">
            <div className={`flex items-center hover:bg-gray-50 border-t border-gray-200 ${isFolder ? 'cursor-pointer' : ''}`}
                 onClick={() => isFolder && setIsExpanded(!isExpanded)}
            >
                <div className="flex-1 p-2.5 flex items-center" style={{ paddingLeft: `${level * 24 + 16}px` }}>
                     <input type="checkbox" className="mr-4" onClick={(e) => e.stopPropagation()} />
                     {isFolder ? (
                         isExpanded ? <FiChevronDown className="mr-2 text-gray-500"/> : <FiChevronRight className="mr-2 text-gray-500"/>
                     ) : <div className="w-[20px] mr-2"></div>}
                     {isFolder ? <FiFolder className="mr-2 text-blue-500"/> : <FiFileText className="mr-2 text-gray-600"/>}
                     <span className="font-medium text-gray-800">{item.name}</span>
                </div>
                <div className="w-1/3 p-2.5 text-gray-600">{isFolder ? item.path : item.path.substring(0, item.path.lastIndexOf('/'))}</div>
                <div className="w-1/4 p-2.5 text-gray-600">{formatDate(item.date)}</div>
                <div className="w-1/6 p-2.5 text-right pr-4">
                    {!isFolder && <button onClick={handleViewScan} className="text-blue-600 font-semibold hover:underline">View Scan</button>}
                </div>
            </div>
            {isFolder && isExpanded && item.children?.map((child) => (
                <InventoryRow key={child.path} item={child} level={level + 1} />
            ))}
        </div>
    )
}

// ------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------
const Inventory = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFileSystemModalOpen, setIsFileSystemModalOpen] = useState(false);
  const configValues = useAppSelector((state) => state.config);
  const dispatch = useAppDispatch();
  const { state } = useLocation();

  
  // Use job manager for consistent job tracking (but don't fetch last results)
  const { isProcessing } = useJobManager({
    jobType: 'inventory',
    enableLastResultFetch: false,
    onJobComplete: (result, resultPath) => {
      // Additional actions when job completes
      console.log('Inventory scan completed, result path:', resultPath);
    },
    onJobError: (error) => {
      toast.error(error.message || 'Failed to complete inventory scan.');
    }
  });

  /* ------------------------------ Mutation ----------------------- */
  const { mutate: startScanInventory, isPending: isStartingScan } = useMutation({
    mutationFn: async (body: scanInventoryDTO) =>
      await ScanService.scanInventory(body),
    onSuccess: (res, data) => {
      toast.loading(
        `Scanning path: ${
          (data as scanInventoryDTO)?.path || configValues?.config?.sourcePath
        }`,
      )

      if (res?.run_id) {
        dispatch(
          startJob({
            jobId: res.run_id as any,
            jobStatus: 'starting',
            jobType: 'inventory',
          }),
        )
      }
    },
    onError: (err: any) =>
      toast.error(err.message || 'Failed to start inventory scan.'),
  })
  


  // Fetch inventory history
  const { data: inventoryHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['inventory-history'],
    queryFn: ScanService.getInventoryHistory,
    initialData: [],
  });

  const groupedAndFilteredData = useMemo(() => {
    // Use inventory history instead of current state
    console.log(state,inventoryHistory,'state data')
    const historyData = [{...state,...state?.report,...state?.run}]||inventoryHistory || [];
    const allFiles = new Map();
    
    // Collect all files from all inventory runs
    historyData.forEach(historyEntry => {
      if (historyEntry.inventory_by_file) {
        historyEntry.inventory_by_file.forEach(record => {
          const filePath = record.file_path;
          const existingFile = allFiles.get(filePath);
          
          // Keep the most recent scan for each file
          if (!existingFile || new Date(historyEntry.timestamp) > new Date(existingFile.date)) {
            allFiles.set(filePath, {
              name: filePath.split('/').pop(),
              path: filePath,
              type: 'file',
              frameworks: record.frameworks,
              components: record.components,
              date: historyEntry.timestamp,
              run_id: historyEntry.run_id,
              status: historyEntry.status
            });
          }
        });
      }
    });

    // Filter based on search query
    const filtered = Array.from(allFiles.values()).filter(file =>
      file.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.frameworks?.join(',').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group files into folder structure
    const root = { children: {} };
    filtered.forEach(file => {
      const pathParts = file.path.split('/');
      let currentLevel = root.children;
      pathParts.forEach((part, index) => {
        const isFileNode = index === pathParts.length - 1;
        if (isFileNode) {
          currentLevel[part] = file;
        } else {
          if (!currentLevel[part]) {
            currentLevel[part] = { 
              name: part, 
              path: pathParts.slice(0, index + 1).join('/'), 
              type: 'folder', 
              children: {} 
            };
          }
          currentLevel = currentLevel[part].children;
        }
      });
    });

    const toArray = (nodes) => Object.values(nodes).map(node => ({ 
      ...node, 
      children: node.children ? toArray(node.children) : undefined 
    }));
    
    return toArray(root.children);
  }, [inventoryHistory, searchQuery]);

  const stats = useMemo(() => {
    const historyData = inventoryHistory || [];
    const allFiles = new Map();
    
    // Get the latest scan for each file from history
    historyData.forEach(historyEntry => {
      if (historyEntry.inventory_by_file) {
        historyEntry.inventory_by_file.forEach(record => {
          const filePath = record.file_path;
          const existingFile = allFiles.get(filePath);
          
          if (!existingFile || new Date(historyEntry.timestamp) > new Date(existingFile.date)) {
            allFiles.set(filePath, {
              ...record,
              date: historyEntry.timestamp
            });
          }
        });
      }
    });
    
    const records = Array.from(allFiles.values());
    return {
      totalFiles: records.length,
      totalComponents: records.reduce((acc, file) => acc + (file.components?.length || 0), 0),
      frameworks: new Set(records.flatMap(file => file.frameworks || [])).size
    };
  }, [inventoryHistory]);

  const handleFolderSelection = (path) => {
    startScanInventory({ path });
    setIsFileSystemModalOpen(false);
  };
  
  return (
    <div className="bg-gray-50 min-h-screen p-6 sm:ml-50" >
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false}/>
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Inventory</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Files Scanned" value={stats.totalFiles} mainStyle />
            <StatCard label="Total Components" value={stats.totalComponents} />
            <StatCard label="Frameworks Used" value={stats.frameworks} />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
                <div className="relative w-full max-w-xs">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Search here..." value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                           className="pl-10 pr-4 py-2 w-full text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"/>
                </div>
                <div className="flex items-center gap-2">
                    <CommonButton onClick={() => setIsFileSystemModalOpen(true)}
                                  loading={isProcessing || isStartingScan} disabled={isProcessing || isStartingScan}
                                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center shadow-sm hover:bg-blue-700 transition-colors disabled:bg-blue-300">
                        Scan for Inventory
                    </CommonButton>
                    <button className="text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-100">Actions</button>
                    <ConfigurationInfo />
                </div>
            </div>

            {isFileSystemModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setIsFileSystemModalOpen(false)}>
                <div className="h-3/4 w-1/2 overflow-hidden rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <FileSystemPage setIsModalOpen={setIsFileSystemModalOpen} handleScan={handleFolderSelection}/>
                </div>
              </div>
            )}
            
            {/* Table Header */}
            <div className="flex items-center bg-gray-50 text-xs text-gray-500 uppercase font-medium border-b border-gray-200">
                <div className="flex-1 p-2.5 flex items-center pl-4"><input type="checkbox" className="mr-4" /> File / Folder Scanned for Inventory</div>
                <div className="w-1/3 p-2.5">Location</div>
                <div className="w-1/4 p-2.5">Date Scanned</div>
                <div className="w-1/6 p-2.5 text-right pr-4">Action</div>
            </div>

            {isLoadingHistory ? <p className="p-4 text-center text-gray-500">Loading inventory...</p> : (
                groupedAndFilteredData.length > 0 ? (
                     groupedAndFilteredData.map((item) => <InventoryRow key={item.path} item={item} />)
                ) : (
                    <div className="text-center py-16 text-gray-500">
                        <p className="font-semibold">No Inventory Found</p>
                        <p className="text-sm mt-1">Run a scan to build your inventory.</p>
                    </div>
                )
            )}
        </div>
    </div>
  )
}

export default Inventory;
