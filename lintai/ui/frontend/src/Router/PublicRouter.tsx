import { Routes, Route } from 'react-router'

import DefaultLayout from '../layout/default.layout'
import {  NotFound } from '../pages'
import Dashboard from '../pages/dashboard/dashboard.page'

const PublicRouter = () => {
  return (
    <Routes>
      <Route path="" element={<DefaultLayout />}>
        <Route path="/" element={<Dashboard />} />
        {/* <Route path="/dashboard" element={<Dashboard />} /> */}
      </Route>
      <Route path="/*" element={<NotFound />} />
    </Routes>
  )
}

export default PublicRouter
