import { useEffect, useRef, useState } from 'react'
import { FaPlus } from 'react-icons/fa6'
import { FiMenu } from 'react-icons/fi'
import {
  TbArrowLeft,

  TbKey,
  TbLayoutDashboard,

  TbServer,

} from 'react-icons/tb'
import { useNavigate } from 'react-router'

import { useAppDispatch, useAppSelector } from '../../redux/services/store'
import { removeUser, User } from '../../redux/services/User/user.slice'
import ConfigurationModal from '../modals/configuration-modal'

const PrivateHeader = ({ userInfo }: { userInfo: User }) => {
  const navigate = useNavigate()
  const [addVisible, setAddVisible] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const user = useAppSelector((state) => state.user.user)
  const headerButtonConfig: Record<
    string,
    {
      label?: string
      onClick?: () => void
      component?: React.ReactNode
      title: string
    }
  > = {
    '/': {
      // label: 'Add New Repo',
      title: 'Reports',
      // onClick: async () => navigate('/filesystem'),
    },
'/inventory': {
      // label: 'Add New Repo',
      title: 'Inventory',
      // onClick: async () => navigate('/filesystem'),
    },

  }
  console.log(user, 'user details')
  // Helper function to get header button config matching the current path
  const getHeaderButtonConfig = (currentPath: string) => {
    for (const route in headerButtonConfig) {
      if (route.includes(':')) {
        // Convert route with dynamic segments to a regex, e.g., '/servers/:id' -> /^\/servers\/[^/]+$/
        const regex = new RegExp('^' + route.replace(/:[^/]+/g, '[^/]+') + '$')
        if (regex.test(currentPath)) {
          return headerButtonConfig[route]
        }
      } else if (route === currentPath) {
        return headerButtonConfig[route]
      }
    }
    return undefined
  }

  // useEffect(() => {
  //   const handleClickOutside = () => {
  //     setSidebarOpen(false)
  //   }
  //   document.addEventListener('click', handleClickOutside)
  //   return () => {
  //     document.removeEventListener('click', handleClickOutside)
  //   }
  // }, [])

  // Get the current path from the browser's location
  const currentPath = location.pathname
  const isNested = currentPath.split('/').filter(Boolean).length > 1

  const headerButton = getHeaderButtonConfig(currentPath)

  const dispatch = useAppDispatch()
  const isActive = (path: string) => currentPath === path
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const handleLogout = () => {
    dispatch(removeUser())
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false)
      }

      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setSidebarOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSidebarClick = (e: React.MouseEvent<HTMLUListElement>) => {
    if ((e.target as HTMLElement).closest('button')) {
      setSidebarOpen(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <nav className="x-10 fixed top-0 z-20 w-full rounded-tl-3xl text-white bg-primary px-4 py-3 sm:pl-40">
        <div className="flex items-center justify-between">
          <div className="flex">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mr-4 text-2xl text-gray-700 sm:hidden"
              >
                <FiMenu />
              </button>
            </div>
            <div className="flex items-center justify-center sm:ml-10">
              {isNested && (
                <button
                  onClick={async () => navigate(-1)}
                  className="text-black-700 mr-4 text-2xl"
                >
                  <TbArrowLeft />
                </button>
              )}

              <h2 className="text-2xl font-bold">{headerButton?.title}</h2>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {headerButton?.onClick && (
              <button
                onClick={headerButton.onClick}
                className="bg-btn-act flex flex-row items-center rounded-lg px-4 py-2 text-base font-bold text-white"
              >
                <FaPlus className="mr-2" />
                {headerButton.label}
              </button>
            )}
   
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 z-50 h-full w-40 bg-gray-100 transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } sm:translate-x-0 md:translate-x-0`}
      >
        <div className="flex h-full flex-col justify-between p-4">
          <div>
            <div className="mb-6">
              <h2 className="text-primary mb-3 text-2xl font-bold">
                Lint Ai
              </h2>
             
            </div>

            <ul
              className="space-y-2 text-gray-700"
              onClick={handleSidebarClick}
            >
     
              <li>
                <button
                  onClick={async () => navigate('/')}
                  className={`flex w-full flex-row rounded-lg px-4 py-2 text-left font-normal ${
                    !isActive('/')
                      ? 'hover:bg-primary/20 hover:text-primaryBgText text-neutral-500'
                      : 'bg-primary text-white'
                  }`}
                >
                  <TbLayoutDashboard
                    size={24}
                    className="mr-2"
                  />
                  Dashboard
                </button>
              </li>
              <li>
                <button
                  onClick={async () => navigate('/inventory')}
                  className={`flex w-full flex-row rounded-lg px-4 py-2 text-left font-normal ${
                    !isActive('/inventory')
                      ? 'hover:bg-primary/20 hover:text-primaryBgText text-neutral-500'
                      : 'bg-primary text-white'
                  }`}
                >
                  <TbServer size={24} className="mr-2"  />
                  Inventory
                </button>
              </li>
              <li>
                <button
                  onClick={() => setConfigModalOpen(true)}
                  className={`flex w-full flex-row rounded-lg px-4 py-2 text-left font-normal ${
                    configModalOpen
                      ? 'bg-primary text-white'
                      : 'hover:bg-primary/20 hover:text-primaryBgText text-neutral-500'
                  }`}
                >
                  <TbServer size={24} className="mr-2" />
                  Configuration
                </button>
              </li>
        
         

            </ul>
          </div>
          <div className="text-sm text-gray-600">
            <p>©Lint Ai</p>
            <p>Version 0.9.1.0</p>
            <div className="mt-2 space-x-4">
              <a href="/privacy" className="hover:underline">
                Privacy Policy
              </a>
            </div>
            <a href="/terms" className="mt-2 hover:underline">
              Terms & Conditions
            </a>
          </div>
        </div>
      </aside>

      {/* Configuration Modal */}
      {configModalOpen && (
        <ConfigurationModal onClose={() => setConfigModalOpen(false)} title="Configuration">
          <div>
            <p>Configuration settings go here.</p>
            {/* Add configuration form or content here */}
          </div>
        </ConfigurationModal>
      )}

      {addVisible && headerButton?.component}
    </div>
  )
}

export default PrivateHeader
