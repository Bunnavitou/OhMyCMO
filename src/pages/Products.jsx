import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Package, TrendingUp, TrendingDown } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'

export default function Products() {
  const { state } = useStore()
  const [q, setQ] = useState('')

  const filtered = useMemo(
    () => state.products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [state.products, q],
  )

  const grouped = useMemo(() => {
    const out = { Product: [], Service: [] }
    for (const p of filtered) {
      const bucket = p.type === 'Service' ? 'Service' : 'Product'
      out[bucket].push(p)
    }
    return out
  }, [filtered])

  return (
    <>
      <PageHeader title="Products & Services" />
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            className="input pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm text-graphite py-6">No matches.</p>
        ) : (
          (['Product', 'Service']).map((bucket) =>
            grouped[bucket].length === 0 ? null : (
              <section key={bucket}>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  {grouped[bucket].map((p) => {
                    const income = p.income.reduce((s, i) => s + Number(i.amount || 0), 0)
                    const expense = p.expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
                    const net = income - expense
                    return (
                      <li key={p.id}>
                        <Link to={`/products/${p.id}`} className="card flex flex-col gap-3 active:scale-[0.99]">
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                              <Package className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{p.name}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-emerald-50 text-emerald-700 rounded-lg p-2">
                              <div className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Income</div>
                              <p className="font-semibold mt-0.5">${income.toLocaleString()}</p>
                            </div>
                            <div className="bg-rose-50 text-rose-700 rounded-lg p-2">
                              <div className="flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Expense</div>
                              <p className="font-semibold mt-0.5">${expense.toLocaleString()}</p>
                            </div>
                            <div className={`rounded-lg p-2 ${net >= 0 ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'}`}>
                              <div>Net</div>
                              <p className="font-semibold mt-0.5">${net.toLocaleString()}</p>
                            </div>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ),
          )
        )}
      </div>
    </>
  )
}
