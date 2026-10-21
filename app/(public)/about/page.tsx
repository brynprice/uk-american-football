import { Metadata } from 'next';
import Link from 'next/link';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

export const metadata: Metadata = {
  title: 'About the Project | Britball Archive',
  description: 'The story, purpose, and origin of the Britball Archive, founded by Bryn Price.',
};

export default function AboutPage() {
  return (
    <ArchiveLayout>
      {/* Header Banner */}
      <section className="py-10 mb-10 border-b-8 border-slate-900">
        <div className="max-w-3xl">
          <span className="bg-blue-100 text-blue-900 font-mono text-xs font-black px-2.5 py-1 uppercase tracking-widest border border-blue-900 inline-block mb-3">
            Origin & Mission
          </span>
          <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter leading-tight mb-4">
            Preserving the History of the Game in Great Britain
          </h1>
          <p className="text-lg md:text-xl text-slate-600 font-sans leading-relaxed">
            From an Excel spreadsheet of Brighton fixtures to a comprehensive national historical record.
          </p>
        </div>
      </section>

      {/* Main Narrative Layout */}
      <div className="space-y-12 mb-16">
        {/* Origin Story */}
        <section className="p-8 md:p-12 bg-white border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)]">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-xs font-black uppercase tracking-wider text-blue-700">Part 01</span>
            <span className="h-px bg-slate-200 flex-1"></span>
            <span className="text-xs font-mono text-slate-400 uppercase">The Spark</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-black uppercase italic mb-6 tracking-tight text-slate-900">
            Where the Idea Came From
          </h2>
          <div className="space-y-5 text-slate-700 font-sans leading-relaxed text-base md:text-lg">
            <p>
              This project didn’t start as a website or a grand database. It started in a simple Excel spreadsheet.
            </p>
            <p>
              For years, I meticulously maintained a log of every game played by the <strong>Brighton Panthers</strong>, charting fixtures all the way back to the team’s very first associate game against the <strong>Essex Blades in 2002</strong>. Every score, every opponent, and every season was tracked row by row.
            </p>
            <p>
              Eventually, curiosity kicked in: <em>Did other teams have this level of data preserved? Could you look up what happened between two university rivals a decade ago?</em>
            </p>
            <p>
              When I went looking, what I found was fragments—snippets on forgotten geocities-era club sites, defunct web forums, old PDF handbooks, and fading newspaper clippings. Dozens of incredible seasons, hard-fought championships, and team histories were simply evaporating from memory.
            </p>
            <p>
              I decided to change that: to build the most comprehensive, verifiable history of British university football (Uniball) ever assembled. As the project gained momentum, it quickly expanded to embrace the entire tapestry of American football across Great Britain.
            </p>
          </div>
        </section>

        {/* The Personal Connection */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-8 p-8 md:p-12 bg-white border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-xs font-black uppercase tracking-wider text-blue-700">Part 02</span>
              <span className="h-px bg-slate-200 flex-1"></span>
              <span className="text-xs font-mono text-slate-400 uppercase">The Connection</span>
            </div>
            <h2 className="text-2xl md:text-4xl font-black uppercase italic mb-6 tracking-tight text-slate-900">
              The Founder’s Story
            </h2>
            <div className="space-y-4 text-slate-700 font-sans leading-relaxed text-base md:text-lg">
              <p>
                My name is <strong>Bryn Price</strong>. My journey in British American football began in the autumn of <strong>2007</strong> when I stepped onto the field for Brighton (then playing as the Brighton Tsunami).
              </p>
              <p>
                I suited up and played for four memorable seasons as a student-athlete for the Tsunami. When my playing days concluded, my passion for the programme and the sport only grew. I transitioned directly onto the coaching staff and have coached at the club every single season since. Today, I am proud to serve as the <strong>Head Coach of the Brighton Panthers</strong>.
              </p>
              <p>
                Living through nearly two decades of British gridiron culture—from cold November mud pitches to national playoffs—instilled a deep respect for the sacrifices made by every player, coach, and volunteer who gives their weekends to this game. That lived experience is the driving force behind this archive.
              </p>
            </div>
          </div>

          <div className="md:col-span-4 p-6 sm:p-8 bg-slate-900 text-white border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(59,130,246,1)]">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-400 block mb-2">
              Profile
            </span>
            <h3 className="text-2xl font-black uppercase italic mb-1 text-white">Bryn Price</h3>
            <p className="text-sm font-mono text-slate-400 mb-6">Founder & Lead Archivist</p>
            
            <div className="space-y-4 text-sm font-sans border-t border-slate-800 pt-4">
              <div>
                <span className="text-xs font-mono uppercase text-slate-400 block">Playing Career</span>
                <span className="font-bold text-white">Brighton Tsunami (2007–2011)</span>
              </div>
              <div>
                <span className="text-xs font-mono uppercase text-slate-400 block">Coaching Role</span>
                <span className="font-bold text-white">Head Coach, Brighton Panthers (2011–Present)</span>
              </div>
              <div>
                <span className="text-xs font-mono uppercase text-slate-400 block">Archive Inception</span>
                <span className="font-bold text-white">2002–Present Tracking</span>
              </div>
            </div>
          </div>
        </section>

        {/* The Core Purpose: What Happened on That Day */}
        <section className="p-8 md:p-12 bg-white border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)]">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-xs font-black uppercase tracking-wider text-blue-700">Part 03</span>
            <span className="h-px bg-slate-200 flex-1"></span>
            <span className="text-xs font-mono text-slate-400 uppercase">The Purpose</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-black uppercase italic mb-6 tracking-tight text-slate-900">
            &ldquo;What Happened on That Day?&rdquo;
          </h2>
          <div className="space-y-5 text-slate-700 font-sans leading-relaxed text-base md:text-lg">
            <p>
              The primary purpose of the <strong>Britball Archive</strong> is simple: <strong>to preserve the history of American Football played in Great Britain and become the definitive one-stop archive to find out what happened on that day.</strong>
            </p>
            <p>
              Whether you are an alumnus looking back at your rookie season, a current coach scouting an upcoming opponent’s head-to-head lineage, or a fan tracking national champions from the 1980s through today, this platform exists so that the record is never lost again.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 my-6 border-t border-b border-slate-200">
              <div className="p-4 bg-slate-50 border border-slate-300">
                <span className="text-blue-700 font-black text-2xl block mb-1">01</span>
                <h4 className="font-bold text-slate-900 mb-1">Evidence First</h4>
                <p className="text-xs text-slate-600 font-sans">
                  We don’t guess. Every score, coach, and award is anchored in primary contemporary records and verified sources.
                </p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-300">
                <span className="text-blue-700 font-black text-2xl block mb-1">02</span>
                <h4 className="font-bold text-slate-900 mb-1">Complete Lineage</h4>
                <p className="text-xs text-slate-600 font-sans">
                  From College Bowl I in 1987 to modern BUCS Premiership national titles, tracing team re-brands and rivalries.
                </p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-300">
                <span className="text-blue-700 font-black text-2xl block mb-1">03</span>
                <h4 className="font-bold text-slate-900 mb-1">Open to All</h4>
                <p className="text-xs text-slate-600 font-sans">
                  A community-accessible resource freely available to fans, players, journalists, and historians.
                </p>
              </div>
            </div>

            <p>
              No team should have their championship forgotten. No player’s MVP performance should vanish with a deleted social media page. This archive is our collective home.
            </p>
          </div>
        </section>

        {/* Help Build the Archive Callout */}
        <section className="p-8 md:p-12 bg-slate-900 text-white border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(59,130,246,1)]">
          <div className="max-w-2xl">
            <span className="bg-amber-400 text-slate-950 font-mono text-[10px] font-black px-2 py-0.5 uppercase tracking-widest rounded mb-3 inline-block">
              COMMUNITY CONTRIBUTIONS
            </span>
            <h3 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-white mb-4">
              Help Us Fill in the Blanks
            </h3>
            <p className="text-slate-300 font-sans leading-relaxed text-base mb-6">
              Do you have old game programmes, team yearbooks, photos of matchday stat sheets, or newspaper clippings in your attic? We want to see them.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/propose-game"
                className="bg-amber-400 text-slate-950 px-6 py-3 font-black uppercase tracking-widest text-xs hover:bg-white transition-colors"
              >
                Submit Missing Scores &rarr;
              </Link>
              <a
                href="mailto:ukaffootballproject@gmail.com"
                className="border-2 border-white text-white px-6 py-3 font-black uppercase tracking-widest text-xs hover:bg-white hover:text-slate-950 transition-colors"
              >
                Email Archival Material
              </a>
            </div>
          </div>
        </section>
      </div>
    </ArchiveLayout>
  );
}
