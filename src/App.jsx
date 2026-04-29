import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell.jsx'
import RequireAuth from './auth/RequireAuth.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import Customers from './pages/Customers.jsx'
import CustomerDetail from './pages/CustomerDetail.jsx'
import CustomerStaff from './pages/CustomerStaff.jsx'
import CustomerProductDetail from './pages/CustomerProductDetail.jsx'
import Products from './pages/Products.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import Partners from './pages/Partners.jsx'
import PartnerDetail from './pages/PartnerDetail.jsx'
import Assets from './pages/Assets.jsx'
import Marketing from './pages/Marketing.jsx'
import MarketingCampaignDetail from './pages/MarketingCampaignDetail.jsx'
import More from './pages/More.jsx'
import MoreProfile from './pages/MoreProfile.jsx'
import MoreSubUsers from './pages/MoreSubUsers.jsx'
import MoreInfluencers from './pages/MoreInfluencers.jsx'
import MoreTCs from './pages/MoreTCs.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="customers/:id/staff" element={<CustomerStaff />} />
        <Route path="customers/:id/products/:linkId" element={<CustomerProductDetail />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="partners" element={<Partners />} />
        <Route path="partners/:id" element={<PartnerDetail />} />
        <Route path="assets" element={<Assets />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="marketing/:id" element={<MarketingCampaignDetail />} />
        <Route path="more" element={<More />} />
        <Route path="more/profile" element={<MoreProfile />} />
        <Route path="more/sub-users" element={<MoreSubUsers />} />
        <Route path="more/influencers" element={<MoreInfluencers />} />
        <Route path="more/tcs" element={<MoreTCs />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
