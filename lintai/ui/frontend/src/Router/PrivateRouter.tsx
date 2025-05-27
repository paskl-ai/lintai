import { Routes, Route } from 'react-router'

import ProtectedRoutes from '../layout/protected.layout'
import {  NotFound } from '../pages'


const PrivateRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<ProtectedRoutes />}>

        {/* <Route index={true} path="/dashboard" element={<Dashboard />} /> */}


        <Route path="/*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default PrivateRouter
