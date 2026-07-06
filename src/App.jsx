import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell.jsx'
import RequireAuth from './auth/RequireAuth.jsx'
import Login from './pages/Login.jsx'

const Home = lazy(() => import('./pages/Home.jsx'))
const Customers = lazy(() => import('./pages/Customers.jsx'))
const CustomerDetail = lazy(() => import('./pages/CustomerDetail.jsx'))
const CustomerStaff = lazy(() => import('./pages/CustomerStaff.jsx'))
const CustomerProductDetail = lazy(() => import('./pages/CustomerProductDetail.jsx'))
const Products = lazy(() => import('./pages/Products.jsx'))
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx'))
const Partners = lazy(() => import('./pages/Partners.jsx'))
const PartnerDetail = lazy(() => import('./pages/PartnerDetail.jsx'))
const Assets = lazy(() => import('./pages/Assets.jsx'))
const Marketing = lazy(() => import('./pages/Marketing.jsx'))
const MarketingCampaignDetail = lazy(() => import('./pages/MarketingCampaignDetail.jsx'))
const More = lazy(() => import('./pages/More.jsx'))
const MoreProfile = lazy(() => import('./pages/MoreProfile.jsx'))
const MoreSubUsers = lazy(() => import('./pages/MoreSubUsers.jsx'))
const MoreInfluencers = lazy(() => import('./pages/MoreInfluencers.jsx'))
const MoreTCs = lazy(() => import('./pages/MoreTCs.jsx'))
const MoreLanguage = lazy(() => import('./pages/MoreLanguage.jsx'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-graphite text-sm">
      Loading…
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
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
          <Route path="more/language" element={<MoreLanguage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
