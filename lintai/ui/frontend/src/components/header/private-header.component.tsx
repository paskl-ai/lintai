import { useEffect, useRef, useState } from 'react'
import { FaPlus } from 'react-icons/fa6'
import { FiMenu } from 'react-icons/fi'
import {
  TbArrowLeft,

  TbBox,

  TbHome,

  TbHome2,

  TbKey,
  TbLayersDifference,
  TbLayersLinked,
  TbLayoutDashboard,

  TbServer,
  TbSettings,
  TbStack,
  TbTerminal,
  TbTerminal2,

} from 'react-icons/tb'
import { useNavigate } from 'react-router'

import { useAppDispatch, useAppSelector } from '../../redux/services/store'
import { removeUser, User } from '../../redux/services/User/user.slice'
import { useQuery } from '@tanstack/react-query'
import { ConfigService } from '../../api/services/Config/config.api'
import { setConfig, setEnv } from '../../redux/services/Config/config.slice'
import { QueryKey } from '../../api/QueryKey'


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
      title: 'Home',
      // onClick: async () => navigate('/filesystem'),
    },
    '/scan': {
      // label: 'Add New Repo',
      title: 'Findings',
      // onClick: async () => navigate('/filesystem'),
    },
    '/catalog': {
      // label: 'Add New Repo',
      title: 'AI Catalog',
      // onClick: async () => navigate('/filesystem'),
    },
    '/configuration': {
      // label: 'Add New Repo',
      title: 'Settings',
      // onClick: async () => navigate('/filesystem'),
    },

  }

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


  // console.log(config)



  return (
    <div>
      {/* Header */}
      <nav className="x-10 fixed top-0 z-50 w-full text-white bg-primary px-4 py-3">
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
            <div className="flex items-center justify-center  px-4">
              {isNested && (
                <button
                  onClick={async () => navigate(-1)}
                  className="text-black-700 mr-4 text-2xl"
                >
                  <TbArrowLeft />
                </button>
              )}
<svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="26" height="26" rx="5" fill="white"/>
<rect x="6.5" y="2.78571" width="7.42857" height="19.5" rx="3.71429" fill="#4554E3" fill-opacity="0.5"/>
<rect x="21.3572" y="14.8571" width="7.42857" height="14.8571" rx="3.71429" transform="rotate(90 21.3572 14.8571)" fill="#4554E3" fill-opacity="0.5"/>
</svg>
              {/* <h2 className="text-2xl font-bold ml-3">{headerButton?.title}</h2> */}
              <h2 className="text-2xl font-bold  ml-3">Lint AI</h2>

            </div>
          </div>
          <div className="flex items-center space-x-4">
            {headerButton?.onClick && (
              <button
                onClick={headerButton.onClick}
                className="bg-btn-act flex flex-row items-center  px-4 py-2 text-base font-bold text-white"
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
        className={`fixed top-0 left-0
          shadow-md
          z-20 h-full w-50 bg-gray-100 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
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
                  onClick={async () => navigate('/home')}
                  className={`flex w-full flex-row  px-4 py-2 text-left font-normal ${!isActive('/home')
                      ? 'hover:bg-primary/20 hover:text-primaryBgText text-neutral-500'
                      : 'bg-primary text-white'
                    }`}
                >
                  <TbHome2
                    size={24}
                    className="mr-2"
                  />
                 Home
                </button>
              </li>
              <li>
                <button
                  onClick={async () => navigate('/findings')}
                  className={`flex w-full flex-row  px-4 py-2 text-left font-normal ${!isActive('/findings')
                      ? 'hover:bg-primary/20 hover:text-primaryBgText text-neutral-500'
                      : 'bg-primary text-white'
                    }`}
                >
                  <TbStack
                    size={24}
                    className="mr-2"
                  />
                  Findings
                </button>
              </li>
              <li>
                <button
                  onClick={async () => navigate('/catalog')}
                  className={`flex w-full flex-row  px-4 py-2 text-left font-normal ${!isActive('/catalog')
                      ? 'hover:bg-primary/20 hover:text-primaryBgText text-neutral-500'
                      : 'bg-primary text-white'
                    }`}
                >
                  <TbTerminal2 size={24} className="mr-2" />
                  AI Catalog
                </button>
              </li>
              <li>
                <button
                  onClick={async () => navigate('/settings')}
                  className={`flex w-full flex-row  px-4 py-2 text-left font-normal ${!isActive('/settings')
                      ? 'hover:bg-primary/20 hover:text-primaryBgText text-neutral-500'
                      : 'bg-primary text-white'
                    }`}
                >
                  <TbSettings size={24} className="mr-2" />
                  Setting
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



      {addVisible && headerButton?.component}
    </div>
  )
}

export default PrivateHeader
