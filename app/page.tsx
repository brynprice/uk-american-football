import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

export default async function HomePage() {
  const competitions = await ArchiveService.getCompetitions();

  return (
    <ArchiveLayout>
      <section className="mb-12">
        <h1 className="text-4xl font-black mb-4 border-b-4 border-slate-900 pb-2">Historic Competitions</h1>
        <p className="text-lg text-slate-600 mb-8 max-w-2xl font-sans">
          Explore the rich history of American football leagues in the UK, from the early regional pioneer days to modern national championships.
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

      <section className="bg-slate-900 text-white p-8 rounded shadow-lg">
        <h3 className="text-xl font-bold mb-4 font-sans uppercase tracking-widest text-slate-400">Archive Status</h3>
        <p className="text-sm opacity-75 mb-6">Database connected. Waiting for historical records.</p>

        <div className="mt-8 pt-8 border-t border-slate-800 text-xs text-slate-400 font-sans italic leading-relaxed">
          <p>Whilst every effort has been made to accurately record results, if you see any inconsistencies or errors, please email <a href="mailto:ukaffootballproject@gmail.com" className="text-blue-400 hover:underline">ukfootballproject@gmail.com</a></p>
        </div>
      </section>
    </ArchiveLayout>
  );
}
