import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useT } from '../i18n/LanguageContext.jsx'
import SaleForm from '../components/SaleForm.jsx'
import { SalesTable, ConvertedNotice } from './Sales.jsx'

// Customer detail › Sales: the sales table for one customer.
export default function CustomerDetailSales({ customer }) {
  const { t } = useT()
  const [form, setForm] = useState(null) // null | { sale } | { defaults }
  const [version, setVersion] = useState(0)
  const [converted, setConverted] = useState(null)

  return (
    <div className="space-y-3">
      <button className="btn-primary text-sm" onClick={() => setForm({ defaults: { customerId: customer.id } })}>
        <Plus className="w-4 h-4" /> {t('sales.new')}
      </button>
      {converted && <ConvertedNotice customer={converted} onClose={() => setConverted(null)} />}
      <SalesTable key={version} customerId={customer.id} onOpen={(s) => setForm({ sale: s })} />
      {form && (
        <SaleForm sale={form.sale} defaults={form.defaults} onClose={() => setForm(null)}
          onSaved={(_s, conversion) => { setForm(null); setVersion((v) => v + 1); if (conversion) setConverted(conversion.customer) }} />
      )}
    </div>
  )
}
