import { Sparkles, Plus } from 'lucide-react'

export default function MoreInfluencers() {
  return (
    <div className="space-y-3">
      <button
        onClick={() => alert('Influencer management is coming soon.')}
        className="btn-primary w-full"
      >
        <Plus className="w-4 h-4" /> Add influencer
      </button>

      <div className="card text-center py-12">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <p className="text-sm md:text-base font-semibold text-near-black">
          No influencers yet
        </p>
        <p className="text-xs md:text-sm text-graphite mt-1 max-w-xs mx-auto">
          Track creator partnerships, payouts and content briefs in one place.
          Full influencer CRM is on the roadmap.
        </p>
      </div>
    </div>
  )
}
