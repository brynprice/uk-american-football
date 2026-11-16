import ArchiveLayout from "@/components/archive/ArchiveLayout";
import GameProposalForm from "@/components/archive/GameProposalForm";

export const revalidate = 604800; // 7 days

export default function ProposeGamePage() {
    return (
        <ArchiveLayout>
            <div className="max-w-4xl mx-auto py-12 px-4">
                <div className="mb-8">
                    <h1 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 border-b-8 border-slate-900 pb-4 inline-block">
                        Archive Contribution
                    </h1>
                </div>
                
                <GameProposalForm />
            </div>
        </ArchiveLayout>
    );
}
