import { login } from './actions'
import ArchiveLayout from '@/components/archive/ArchiveLayout'

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const searchParams = await props.searchParams
  const error = searchParams.error
  const next = searchParams.next || '/admin'

  return (
    <ArchiveLayout>
      <div className="max-w-md mx-auto mt-12">
        <div className="bg-white border-4 border-slate-900 p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
          <h1 className="text-4xl font-black mb-8 uppercase italic tracking-tighter">Admin Login</h1>
          
          {error && (
            <div className="bg-red-100 border-2 border-red-600 p-4 mb-6 font-bold text-red-700 shadow-[4px_4px_0px_0px_rgba(220,38,38,1)]">
              {error}
            </div>
          )}

          <form action={login} className="flex flex-col gap-6">
            <input type="hidden" name="next" value={next} />
            
            <div>
              <label className="block text-sm font-black uppercase mb-2 tracking-tight">Email Address</label>
              <input 
                name="email" 
                type="email" 
                required 
                className="w-full border-2 border-slate-900 p-3 text-lg font-sans focus:outline-none focus:ring-0 focus:border-blue-600 focus:shadow-[4px_4px_0px_0px_rgba(37,99,235,1)] transition-all"
                placeholder="admin@britball.org"
              />
            </div>

            <div>
              <label className="block text-sm font-black uppercase mb-2 tracking-tight">Password</label>
              <input 
                name="password" 
                type="password" 
                required 
                className="w-full border-2 border-slate-900 p-3 text-lg font-sans focus:outline-none focus:ring-0 focus:border-blue-600 focus:shadow-[4px_4px_0px_0px_rgba(37,99,235,1)] transition-all"
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit"
              className="mt-4 bg-blue-600 text-white font-black py-4 uppercase tracking-widest text-xl border-2 border-slate-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:translate-x-0 active:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              Sign In
            </button>
          </form>
        </div>
        <p className="mt-8 text-center text-slate-500 font-sans italic">
          Restricted access for archive administrators only.
        </p>
      </div>
    </ArchiveLayout>
  )
}
