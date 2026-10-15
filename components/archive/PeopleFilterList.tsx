'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { PersonWithRoles } from '@/services/archive-service';

interface PeopleFilterListProps {
    people: PersonWithRoles[];
}

interface Affiliation {
    teamName: string;
    years: number[];
}

function formatSeasonLabel(year: number): string {
    const nextYearShort = String((year + 1) % 100).padStart(2, '0');
    return `${year}/${nextYearShort}`;
}

function formatAffiliationYears(years: number[]): string {
    if (years.length === 0) return '';
    const sortedYears = Array.from(new Set(years)).sort((a, b) => a - b);

    // Group consecutive sequences
    const groups: number[][] = [];
    let currentGroup: number[] = [sortedYears[0]];
    for (let i = 1; i < sortedYears.length; i++) {
        const y = sortedYears[i];
        if (y === currentGroup[currentGroup.length - 1] + 1) {
            currentGroup.push(y);
        } else {
            groups.push(currentGroup);
            currentGroup = [y];
        }
    }
    groups.push(currentGroup);

    return groups.map((g) => {
        if (g.length === 1) {
            return formatSeasonLabel(g[0]);
        }
        const start = g[0];
        const end = g[g.length - 1] + 1;
        return `${start}–${end}`;
    }).join(', ');
}

export default function PeopleFilterList({ people }: PeopleFilterListProps) {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortBy, setSortBy] = useState<'display_name' | 'last_name'>('display_name');
    const [selectedLetter, setSelectedLetter] = useState<string>('All');

    // Extract affiliations for each person
    const peopleWithAffiliations = useMemo(() => {
        return people.map((person) => {
            const map = new Map<string, Set<number>>();
            (person.participations || []).forEach((p) => {
                const teamName = p.teams?.name;
                const year = p.phases?.seasons?.year;
                if (teamName) {
                    if (!map.has(teamName)) map.set(teamName, new Set());
                    if (year) map.get(teamName)!.add(year);
                }
            });

            const affiliations: Affiliation[] = Array.from(map.entries())
                .map(([teamName, yearsSet]) => ({
                    teamName,
                    years: Array.from(yearsSet).sort((a, b) => a - b)
                }))
                .sort((a, b) => a.teamName.localeCompare(b.teamName));

            // Determine effective surname for sorting
            const surname = (person.last_name || person.display_name.trim().split(' ').pop() || '').trim();

            return {
                ...person,
                affiliations,
                surname
            };
        });
    }, [people]);

    // Available letters based on current sort mode
    const letterCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (let i = 65; i <= 90; i++) {
            counts[String.fromCharCode(i)] = 0;
        }

        peopleWithAffiliations.forEach((p) => {
            const keyString = sortBy === 'last_name' ? p.surname : p.display_name;
            const firstLetter = keyString.trim().charAt(0).toUpperCase();
            if (firstLetter >= 'A' && firstLetter <= 'Z') {
                counts[firstLetter] = (counts[firstLetter] || 0) + 1;
            }
        });

        return counts;
    }, [peopleWithAffiliations, sortBy]);

    // Filter & Sort
    const filteredAndSortedPeople = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        const filtered = peopleWithAffiliations.filter((person) => {
            // Letter filter
            if (selectedLetter !== 'All') {
                const keyString = sortBy === 'last_name' ? person.surname : person.display_name;
                const firstLetter = keyString.trim().charAt(0).toUpperCase();
                if (firstLetter !== selectedLetter) return false;
            }

            // Search query filter
            if (q === '') return true;

            const nameMatch =
                person.display_name.toLowerCase().includes(q) ||
                (person.first_name && person.first_name.toLowerCase().includes(q)) ||
                (person.last_name && person.last_name.toLowerCase().includes(q)) ||
                person.surname.toLowerCase().includes(q);

            if (nameMatch) return true;

            const teamMatch = person.affiliations.some((aff) =>
                aff.teamName.toLowerCase().includes(q) ||
                formatAffiliationYears(aff.years).toLowerCase().includes(q) ||
                aff.years.some((y) => String(y).includes(q) || formatSeasonLabel(y).toLowerCase().includes(q))
            );

            return teamMatch;
        });

        return filtered.sort((a, b) => {
            if (sortBy === 'last_name') {
                const cmp = a.surname.localeCompare(b.surname, undefined, { sensitivity: 'base' });
                if (cmp !== 0) return cmp;
                return a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' });
            }
            return a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' });
        });
    }, [peopleWithAffiliations, searchQuery, sortBy, selectedLetter]);

    const alphabet = useMemo(() => {
        return Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
    }, []);

    return (
        <div className="space-y-6">
            {/* Search & Sort Controls Bar */}
            <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg space-y-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    {/* Sort Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-sans">Sort By:</span>
                        <div className="flex gap-1">
                            <button
                                type="button"
                                onClick={() => setSortBy('display_name')}
                                className={`px-3 py-1.5 rounded text-xs font-bold font-sans transition-all ${
                                    sortBy === 'display_name'
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                                }`}
                            >
                                First Name (A–Z)
                            </button>
                            <button
                                type="button"
                                onClick={() => setSortBy('last_name')}
                                className={`px-3 py-1.5 rounded text-xs font-bold font-sans transition-all ${
                                    sortBy === 'last_name'
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                                }`}
                            >
                                Surname (A–Z)
                            </button>
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="w-full md:w-80">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search by name, team, or year..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-xs font-sans border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <svg
                                className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Alphabet Jump Bar */}
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setSelectedLetter('All')}
                        className={`px-2 py-1 rounded text-xs font-bold font-sans transition-all ${
                            selectedLetter === 'All'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                    >
                        All ({people.length})
                    </button>
                    {alphabet.map((letter) => {
                        const count = letterCounts[letter] || 0;
                        const hasItems = count > 0;
                        const isSelected = selectedLetter === letter;

                        return (
                            <button
                                key={letter}
                                type="button"
                                disabled={!hasItems}
                                onClick={() => setSelectedLetter(letter)}
                                className={`px-2 py-1 rounded text-xs font-bold font-mono transition-all ${
                                    isSelected
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : hasItems
                                            ? 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                                            : 'bg-slate-100 text-slate-300 border border-slate-100 cursor-not-allowed'
                                }`}
                                title={`${letter}: ${count} people`}
                            >
                                {letter}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Results Count & Active Filters Indicator */}
            <div className="flex justify-between items-center text-xs text-slate-500 font-sans">
                <div>
                    Showing <span className="font-bold text-slate-800">{filteredAndSortedPeople.length}</span> of{' '}
                    <span className="font-bold text-slate-800">{people.length}</span> people
                    {selectedLetter !== 'All' && <span> under &quot;{selectedLetter}&quot;</span>}
                    {searchQuery && <span> matching &quot;{searchQuery}&quot;</span>}
                </div>
                {(selectedLetter !== 'All' || searchQuery !== '') && (
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedLetter('All');
                            setSearchQuery('');
                        }}
                        className="text-blue-600 hover:underline font-semibold"
                    >
                        Clear Filters
                    </button>
                )}
            </div>

            {/* People Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAndSortedPeople.map((person) => (
                    <Link
                        key={person.id}
                        href={`/people/${person.id}`}
                        className="group flex flex-col justify-between p-6 bg-white border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition-all rounded"
                    >
                        <div>
                            <div className="flex items-baseline justify-between gap-2">
                                <h2 className="text-xl font-bold group-hover:text-blue-700 transition-colors leading-tight">
                                    {person.display_name}
                                </h2>
                                {sortBy === 'last_name' && person.surname && (
                                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                                        {person.surname}
                                    </span>
                                )}
                            </div>

                            {/* Team / Role Affiliations */}
                            {person.affiliations.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {person.affiliations.map((aff) => (
                                        <span
                                            key={aff.teamName}
                                            className="inline-block bg-slate-100 text-slate-800 text-[11px] font-sans px-2 py-0.5 rounded border border-slate-200 leading-tight"
                                        >
                                            <span className="font-semibold">{aff.teamName}</span>{' '}
                                            {aff.years.length > 0 && (
                                                <span className="text-slate-500 font-mono">
                                                    ({formatAffiliationYears(aff.years)})
                                                </span>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-2 text-xs text-slate-400 font-sans italic">
                                    Historical Figure
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-blue-600 font-semibold group-hover:translate-x-1 transition-transform">
                            <span>View Career Profile &rarr;</span>
                        </div>
                    </Link>
                ))}

                {filteredAndSortedPeople.length === 0 && (
                    <div className="col-span-full p-12 text-center bg-white border border-dashed border-slate-300 rounded">
                        <p className="text-slate-500 font-sans font-medium mb-1">No people match your current search.</p>
                        <p className="text-xs text-slate-400 font-sans">
                            Try adjusting your search terms or clearing the letter filter.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedLetter('All');
                                setSearchQuery('');
                            }}
                            className="mt-4 px-4 py-1.5 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800 transition-colors"
                        >
                            Reset Filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
