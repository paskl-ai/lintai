import { useAppSelector } from '../redux/services/store'

import PrivateRouter from './PrivateRouter'
import PubliceRouter from './PublicRouter'

const RootRouter = () => {
  const user = useAppSelector((state) => state.user.user)
  console.log(!!user, 'user info')
  return (
    <>
    <PubliceRouter />
      {/* <Route path="/*" element={<NotFound />} /> */}
    </>
  )
}

export default RootRouter
