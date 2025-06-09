import { Routes, Route } from 'react-router'

import DefaultLayout from '../layout/default.layout'
import { NotFound } from '../pages'
import Dashboard from '../pages/dashboard/dashboard.page'
import DataFlowVisualise from '../pages/graph/DataFlowVisualise'
import FileSystemPage from '../pages/filesystem/filesystem.page'
import Inventory from '../pages/inventory/inventory.page'
import ConfigurationPage from '../pages/configuration-page'
import Scan from '../pages/scan/scan.page'

const PublicRouter = () => {
  return (
    <Routes>
      <Route path="" element={<DefaultLayout />}>
      <Route path="/home" element={<Dashboard />} />

        <Route path="/findings" element={<Scan />} />
        <Route path="/data-flow" element={<DataFlowVisualise />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/settings" element={<ConfigurationPage />} />

      </Route>
      <Route path="/*" element={<NotFound />} />
    </Routes>
  )
}

export default PublicRouter
