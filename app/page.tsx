import Link from 'next/link';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

export const revalidate = 0;

export default async function HomePage() {
  return (
    <ArchiveLayout>
      <section className="py-20 mb-12 border-b-8 border-slate-900">
        <div className="max-w-3xl">
          <h1 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none mb-8">
            The Historical Record of Britball
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 font-sans leading-relaxed mb-10">
            Welcome to the <strong>Britball Archive</strong>, the home for British American Football history. 
            We are documenting every league, team, and score from the 1980s pioneers to the modern national stage.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link 
              href="/competitions" 
              className="bg-slate-900 text-white text-center px-10 py-5 font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-[8px_8px_0px_0px_rgba(255,255,255,1),8px_8px_0px_1px_rgba(15,23,42,1)]"
            >
              Browse the Vault &rarr;
            </Link>
            <Link 
              href="/teams" 
              className="bg-white border-2 border-slate-900 text-slate-900 text-center px-10 py-5 font-black uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-[8px_8px_0px_0px_rgba(15,23,42,1)]"
            >
              Search Teams
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-20 grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="p-8 md:p-12 bg-white border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)]">
          <h2 className="text-3xl font-black uppercase italic mb-6 tracking-tighter">The Mission</h2>
          <div className="space-y-4 text-slate-700 font-sans leading-relaxed text-lg">
            <p>
              The <strong>Britball Archive</strong> is the definitive historical record of American football in the United Kingdom. 
              Our mission is to catalog every game ever played on British soil—from the pioneering regional leagues of the 1980s to the elite national championships of today.
            </p>
            <p>
              British American football has a rich, multi-decade legacy that often lives in dusty programmes, old local newspapers, and the memories of those who played. We are digitising this history to ensure that every touchdown, rivalry, and championship is preserved for future generations of fans and players.
            </p>
          </div>
        </div>

        <div className="p-8 md:p-12 bg-slate-900 text-white">
          <h2 className="text-3xl font-black uppercase italic mb-6 tracking-tighter text-blue-400">How You Can Help</h2>
          <div className="space-y-6 font-sans leading-relaxed">
            <p className="text-slate-300">
              This is a community-driven project, and we need your help to fill the gaps in the record. If you have historical information, you can contribute in several ways:
            </p>
            <ul className="space-y-4">
              <li className="flex gap-4">
                <span className="font-black text-blue-400">01</span>
                <span><strong>Missing Scores:</strong> Use our <Link href="/propose-game" className="text-blue-400 hover:underline">Contribute</Link> tool to submit missing game results or corrections.</span>
              </li>
              <li className="flex gap-4">
                <span className="font-black text-blue-400">02</span>
                <span><strong>Archival Material:</strong> If you have old programmes, league handbooks, or newspaper clippings, please get in touch.</span>
              </li>
              <li className="flex gap-4">
                <span className="font-black text-blue-400">03</span>
                <span><strong>Verify Data:</strong> Browse your old team's history and let us know if you spot any inconsistencies.</span>
              </li>
            </ul>
            <div className="pt-6 border-t border-slate-700">
              <p className="text-sm italic text-slate-400">
                Spotted an error? Have a lead on old records? Email us at <a href="mailto:ukaffootballproject@gmail.com" className="text-blue-400 font-bold hover:underline">ukaffootballproject@gmail.com</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-blue-600 text-white p-12 rounded-sm shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <h3 className="text-2xl font-black mb-2 uppercase tracking-tight">Archive Status</h3>
          <p className="text-lg opacity-90 font-sans">Britball Archive database connected. Actively expanding historical records.</p>
        </div>
        <div className="flex gap-4 text-xs font-black uppercase tracking-[0.2em]">
          <div className="bg-blue-800 px-4 py-2 rounded">API: Online</div>
          <div className="bg-blue-800 px-4 py-2 rounded">Records: Synchronized</div>
        </div>
      </section>
    </ArchiveLayout>
  );
}
