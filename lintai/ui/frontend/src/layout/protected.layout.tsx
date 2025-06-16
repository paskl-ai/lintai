import { Navigate, Outlet } from 'react-router'

import PrivateHeader from '../components/header/private-header.component'
import { useAppSelector } from '../redux/services/Store'

const ProtectedRoutes = () => {
  const user = useAppSelector((state) => state.user.user)
  return user ? (
    <>
      <PrivateHeader userInfo={user} key={user.id} />
      <div className="p-4">
        <div className="mt-14">
          <Outlet />
        </div>
      </div>
    </>
  ) : (
    <Navigate to="/login" replace />
  )
}
export default ProtectedRoutes
