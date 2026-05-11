import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { StoreProvider } from './store/StoreContext.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <StoreProvider>
            <App />
          </StoreProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
