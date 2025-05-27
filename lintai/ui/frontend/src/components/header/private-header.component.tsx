import { useState } from 'react'
import { FiMenu } from 'react-icons/fi'
import { useNavigate } from 'react-router'
import { User } from '../../redux/services/User/user.slice'



const PrivateHeader = ({ userInfo }: { userInfo: User }) => {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isActive = (path: string) => location.pathname === path

  return (
    <>
      {/* Header */}
      <nav className="fixed top-0 z-40 w-full bg-white px-4 py-3 sm:pl-64">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {/* Mobile Sidebar Toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="mr-4 text-2xl text-gray-700 sm:hidden"
            >
              <FiMenu />
            </button>
            <h1 className="ml-5 text-xl font-bold tracking-wide text-gray-800">
              {userInfo?.email}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <button className="bg-btn-act rounded-lg px-4 py-2 text-white">
              <span className="text-white">+</span>
              <span className="text-white">Add New Server</span>
            </button>

            {/* Profile Icon */}
            <button
              className="flex items-center space-x-4"
              onClick={async () => navigate('/profile')}
            >
              <img
                className="h-8 w-8 rounded-full"
                src="https://flowbite.com/docs/images/people/profile-picture-5.jpg"
                alt="User Profile"
              />
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 border-r bg-gray-100 transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } sm:translate-x-0`}
      >
        <div className="flex h-full flex-col justify-between p-4">
          {/* Logo */}
          <div>
            <h2 className="text-primary mb-6 text-2xl font-bold">
              LintAi
            </h2>
            {/* Navigation */}
            <ul className="space-y-2 text-gray-700">
              <li>
                <button
                  className="bg-primaryBg flex w-full justify-between rounded-lg px-4 py-2 text-left font-bold text-blue-800"
                  onClick={async () => navigate('/add-server')}
                >
                  Add New Server
                  <span>+</span>
                </button>
              </li>
              <li>
                <button
                  onClick={async () => navigate('/dashboard')}
                  className={`w-full rounded-lg px-4 py-2 text-left font-normal text-neutral-500 hover:bg-gray-200 ${
                    isActive('/dashboard') && 'text-primary'
                  }`}
                >
                  Dashboard
                </button>
              </li>
              <li>
                <button
                  onClick={async () => navigate('/servers')}
                  className={`w-full rounded-lg px-4 py-2 text-left font-normal text-neutral-500 hover:bg-gray-200 ${
                    isActive('/servers') && 'text-primary'
                  }`}
                >
                  Servers
                </button>
              </li>
              <li>
                <button
                  onClick={async () => navigate('/ssh-keys')}
                  className={`w-full rounded-lg px-4 py-2 text-left font-normal text-neutral-500 hover:bg-gray-200 ${
                    isActive('/ssh-keys') && 'text-primary'
                  }`}
                >
                  SSH Keys
                </button>
              </li>
              <li>
                <button
                  onClick={async () => navigate('/users')}
                  className={`w-full rounded-lg px-4 py-2 text-left font-normal text-neutral-500 hover:bg-gray-200 ${
                    isActive('/users') && 'text-primary'
                  }`}
                >
                  Users
                </button>
              </li>
              <li>
                <button
                  onClick={async () => navigate('/billing')}
                  className={`w-full rounded-lg px-4 py-2 text-left font-normal text-neutral-500 hover:bg-gray-200 ${
                    isActive('/billing') && 'text-primary'
                  }`}
                >
                  Billing
                </button>
              </li>
            </ul>
          </div>

          {/* Footer */}
          <div className="text-sm text-gray-600">
            <p>Copyright LintAi™</p>
            <p>Version 1.2.0.5</p>
            <div className="mt-2 flex space-x-4">
              <a href="/privacy" className="hover:underline">
                Privacy Policy
              </a>
              <a href="/terms" className="hover:underline">
                Terms & Conditions
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

export default PrivateHeader
