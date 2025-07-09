import { Routes, Route } from 'react-router'

import DefaultLayout from '../layout/default.layout'
import { NotFound } from '../pages'
import Dashboard from '../pages/dashboard/dashboard.page'
import DataFlowVisualise from '../pages/graph/DataFlowVisualise'
import FileSystemPage from '../pages/filesystem/filesystem.page'
import Inventory from '../pages/inventory/inventory.page'
import ConfigurationPage from '../pages/configuration-page'
import Scan from '../pages/scan/scan.page'
import FindingsDetailsPage from '../pages/details/findings-details.page'
import InventoryDetailsPage from '../pages/details/inventory-details.page'

const PublicRouter = () => {
  return (
    <Routes>
      <Route path="" element={<DefaultLayout />}>
        <Route path="/home" element={<Dashboard />} />

        <Route path="/findings" element={<Scan />} >
        </Route>
        <Route path="/findings/details/:pagelocation" element={<FindingsDetailsPage />} />

        <Route path="/inventory" element={<Inventory />} >
        </Route>
        <Route path="/inventory/:id" element={<Inventory />} />

        <Route path="/inventory/details/:pagelocation" element={<InventoryDetailsPage />} />


        <Route path="/settings" element={<ConfigurationPage />} />
        <Route path="/data-flow" element={<DataFlowVisualise />} />
      </Route>
      <Route path="/*" element={<NotFound />} />
    </Routes>
  )
}

export default PublicRouter
