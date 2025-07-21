import { Routes, Route } from 'react-router'

import DefaultLayout from '../layout/default.layout'
import { NotFound } from '../pages'
import Dashboard from '../pages/dashboard/dashboard.page'
import DataFlowVisualise from '../pages/graph/DataFlowVisualise'
import FileSystemPage from '../pages/filesystem/filesystem.page'
import Catalog from '../pages/catalog/catalog.page'
import ConfigurationPage from '../pages/configuration-page'
import Findings from '../pages/findings/findings.page'
import FindingsDetailsPage from '../pages/details/findings-details.page'
import InventoryDetailsPage from '../pages/details/inventory-details.page'

const PublicRouter = () => {
  return (
    <Routes>
      <Route path="" element={<DefaultLayout />}>
      <Route index element={<Dashboard />} />

        <Route path="/home" element={<Dashboard />} />

        <Route path="/findings" element={<Findings />} >
        </Route>
        <Route path="/findings/details/:pagelocation" element={<FindingsDetailsPage />} />

        <Route path="/catalog" element={<Catalog />} >
        </Route>
        <Route path="/catalog/:id" element={<Catalog />} />

        <Route path="/catalog/details/:pagelocation" element={<InventoryDetailsPage />} />


        <Route path="/settings" element={<ConfigurationPage />} />
        {/* <Route path="/data-flow" element={<DataFlowVisualise />} /> */}
      </Route>
      <Route path="/*" element={<NotFound />} />
    </Routes>
  )
}

export default PublicRouter
