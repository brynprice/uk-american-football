import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
export const revalidate = 0;

export default async function HomePage() {
  const competitions = await ArchiveService.getCompetitions();

  return (
    <ArchiveLayout>
      <section className="mb-12">
        <h1 className="text-4xl font-black mb-4 border-b-4 border-slate-900 pb-2">Historic Competitions</h1>
        <p className="text-lg text-slate-600 mb-8 max-w-2xl font-sans">
          Welcome to the <strong>Britball Archive</strong>, the home for British American Football history. 
          Explore leagues, teams, and scores from the early regional pioneer days to modern national championships.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {competitions.map((comp) => (
            <Link
              key={comp.id}
              href={`/competitions/${comp.id}`}
              className="group block p-6 bg-white border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-bold group-hover:text-blue-700 transition-colors">{comp.name}</h2>
                <span className="text-xs font-sans uppercase bg-slate-100 px-2 py-1 rounded text-slate-500">
                  {comp.level}
                </span>
              </div>
              <p className="text-slate-500 text-sm line-clamp-2 font-sans mb-4">
                {comp.description || "Historical records and statistics for this competition."}
              </p>
              <span className="text-sm font-bold text-blue-600 group-hover:underline">View Seasons &rarr;</span>
            </Link>
          ))}

          {(!competitions || competitions.length === 0) && (
            <div className="col-span-full p-12 text-center bg-white border border-dashed border-slate-300 rounded">
              <p className="text-slate-400 font-sans italic">No competitions found in the database yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-12 bg-slate-50 border-y-2 border-slate-200">
        <div className="p-8 md:p-12 border-b-2 md:border-b-0 md:border-r-2 border-slate-200">
          <h2 className="text-3xl font-black uppercase italic mb-6 tracking-tighter">The Mission</h2>
          <div className="space-y-4 text-slate-700 font-sans leading-relaxed">
            <p>
              The <strong>Britball Archive</strong> is the definitive historical record of American football in the United Kingdom. 
              Our mission is to catalog every game ever played on British soil—from the pioneering regional leagues of the 1980s to the elite national championships of today.
            </p>
            <p>
              British American football has a rich, multi-decade legacy that often lives in dusty programmes, old local newspapers, and the memories ofThose who played. We are digitising this history to ensure that every touchdown, rivalry, and championship is preserved for future generations of fans and players.
            </p>
          </div>
        </div>

        <div className="p-8 md:p-12">
          <h2 className="text-3xl font-black uppercase italic mb-6 tracking-tighter">How You Can Help</h2>
          <div className="space-y-4 text-slate-700 font-sans leading-relaxed">
            <p>
              This is a community-driven project, and we need your help to fill the gaps in the record. If you have historical information, you can contribute in several ways:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Missing Scores:</strong> Use our <Link href="/propose-game" className="text-blue-600 font-bold hover:underline">Contribute</Link> tool to submit missing game results or corrections.</li>
              <li><strong>Archival Material:</strong> If you have old programmes, league handbooks, or newspaper clippings, please get in touch.</li>
              <li><strong>Verify Data:</strong> Browse your old team's history and let us know if you spot any inconsistencies.</li>
            </ul>
            <p className="pt-4 border-t border-slate-200 text-sm italic">
              Spotted an error? Have a lead on old records? Email us at <a href="mailto:ukaffootballproject@gmail.com" className="text-blue-600 font-bold hover:underline">ukaffootballproject@gmail.com</a>
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-900 text-white p-8 rounded shadow-lg">
        <h3 className="text-xl font-bold mb-4 font-sans uppercase tracking-widest text-slate-400">Archive Status</h3>
        <p className="text-sm opacity-75 mb-6">Britball Archive database connected. Actively expanding historical records.</p>

        <div className="mt-8 pt-8 border-t border-slate-800 text-xs text-slate-400 font-sans italic leading-relaxed">
          <p>Whilst every effort has been made to accurately record results, if you see any inconsistencies or errors, please email <a href="mailto:ukaffootballproject@gmail.com" className="text-blue-400 hover:underline">ukaffootballproject@gmail.com</a></p>
        </div>
      </section>
    </ArchiveLayout>
  );
}
