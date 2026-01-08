'use client'

import { useState, useMemo } from 'react'
import { getNextPickupDates, formatDate } from '../utils/dateHelpers'

// --- Types based on the new JSON structure ---

interface WasteRoot {
  platnost: string
  oblasti: Area[]
}

interface Area {
  nazev: string
  typy_odpadu?: WasteDetail[]
  pravidlo?: string
  ulice?: string[] // For Sídliště
  svozovy_den?: string
  cisla_popisna?: number[]
  popis?: string
}

interface WasteDetail {
  typ: string // e.g., "Směsný ...", "Plast"
  frekvence?: string
  rozpis_dle_dnu?: Record<string, string[]> | string
  skupiny?: GlassGroup[]
}

interface GlassGroup {
  svozovy_den: string
  tydny: number[]
  ulice: string[]
}

type PickupInfo = {
  wasteType: string
  dayName: string
  dates: Date[]
  description?: string
  areaName: string
}

type StreetResult = {
  streetName: string
  schedules: PickupInfo[]
}

// --- Helpers ---

// Map JSON keys (no accents) to Czech day names
const dayKeyMap: Record<string, string> = {
  Utery: 'Úterý',
  Streda: 'Středa',
  Ctvrtek: 'Čtvrtek',
  Patek: 'Pátek',
  Pondeli: 'Pondělí',
}

const normalizeDay = (key: string): string => dayKeyMap[key] || key

const parseWeekFrequency = (freq: string): number[] | 'sudé' | 'liché' => {
  if (!freq) return 'sudé'
  const lower = freq.toLowerCase()

  // Check for explicit list in parens first: "(3, 7, ...)"
  const match = freq.match(/\(([\d, ]+)\)/)
  if (match) {
    return match[1]
      .split(',')
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n))
  }

  if (lower.includes('sudé')) return 'sudé'
  if (lower.includes('liché')) return 'liché'

  return 'sudé' // Default fallback
}

export default function WasteLookup({ data }: { data: WasteRoot }) {
  const [query, setQuery] = useState('')

  const results: StreetResult[] = useMemo(() => {
    if (!query || query.length < 2) return []

    const normalizedQuery = query.toLowerCase().trim()
    // Check if query looks like a number (for exceptions)
    const queryIsNumber = /^\d+$/.test(normalizedQuery)
    const queryNumber = queryIsNumber ? parseInt(normalizedQuery) : null

    const foundMap = new Map<string, PickupInfo[]>()

    const addInfo = (street: string, info: PickupInfo) => {
      const key = street // Might normalize key differently if needed
      if (!foundMap.has(key)) foundMap.set(key, [])
      foundMap.get(key)!.push(info)
    }

    // Iterate through all Areas
    data.oblasti.forEach((area) => {
      // 1. Handle "Mimo sídliště" (Standard Residential)
      if (area.typy_odpadu) {
        // We need to resolve SKO streets first because Plast/Papir refer to them
        const skoType = area.typy_odpadu.find(
          (t) => t.typ.includes('Směsný') || t.typ.includes('SKO')
        )
        const skoStreetsMap = new Map<string, string>() // Street -> DayKey (e.g. "Myslivecká..." -> "Utery")

        if (skoType && typeof skoType.rozpis_dle_dnu === 'object') {
          Object.entries(skoType.rozpis_dle_dnu).forEach(
            ([dayKey, streets]) => {
              if (Array.isArray(streets)) {
                streets.forEach((street) => {
                  skoStreetsMap.set(street, dayKey)

                  // Check match for SKO
                  if (street.toLowerCase().includes(normalizedQuery)) {
                    addInfo(street, {
                      wasteType: 'Směsný odpad (SKO)',
                      dayName: normalizeDay(dayKey),
                      dates: getNextPickupDates(
                        parseWeekFrequency(skoType.frekvence || 'sudé'),
                        normalizeDay(dayKey)
                      ),
                      areaName: area.nazev,
                    })
                  }
                })
              }
            }
          )
        }

        // Handle Plast & Papir (referencing SKO streets)
        // Filter types that use "Stejný rozpis..."
        area.typy_odpadu.forEach((waste) => {
          if (waste.typ.includes('Plast') || waste.typ.includes('Papír')) {
            // Check if it's the referencing type
            if (
              typeof waste.rozpis_dle_dnu === 'string' &&
              waste.rozpis_dle_dnu.includes('Stejný rozpis')
            ) {
              // Iterate all known SKO streets to find matches
              skoStreetsMap.forEach((dayKey, street) => {
                if (street.toLowerCase().includes(normalizedQuery)) {
                  addInfo(street, {
                    wasteType: waste.typ,
                    description: waste.frekvence, // e.g. "Liché týdny..."
                    dayName: normalizeDay(dayKey),
                    dates: getNextPickupDates(
                      parseWeekFrequency(waste.frekvence || ''),
                      normalizeDay(dayKey)
                    ),
                    areaName: area.nazev,
                  })
                }
              })
            }
          }
        })

        // Handle Sklo (Groups)
        const skloType = area.typy_odpadu.find((t) => t.typ.includes('Sklo'))
        if (skloType && skloType.skupiny) {
          skloType.skupiny.forEach((group) => {
            group.ulice.forEach((street) => {
              if (street.toLowerCase().includes(normalizedQuery)) {
                addInfo(street, {
                  wasteType: 'Sklo',
                  dayName: group.svozovy_den, // "Pátek"
                  dates: getNextPickupDates(group.tydny, group.svozovy_den),
                  areaName: area.nazev,
                  description: skloType.poznamka,
                })
              }
            })
          })
        }
      }

      // 2. Handle "Sídliště" (Housing Estates)
      if (area.nazev.includes('Sídliště') && area.ulice) {
        area.ulice.forEach((street) => {
          // In new JSON, Sídliště is just a list of streets, pickup every Monday
          if (street.toLowerCase().includes(normalizedQuery)) {
            // Generate next 4 Mondays
            // "Pondělí"
            const dates = getNextPickupDates(
              [
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
                18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
                34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
                50, 51, 52, 53,
              ],
              'Pondělí',
              4
            )

            addInfo(street, {
              wasteType: 'Sídliště - Kompletní svoz',
              dayName: 'Pondělí',
              dates: dates,
              description: area.pravidlo,
              areaName: area.nazev,
            })
          }
        })
      }

      // 3. Handle Exceptions (house numbers)
      if (area.cisla_popisna && queryNumber !== null) {
        if (area.cisla_popisna.includes(queryNumber)) {
          // Match found for house number
          const houseStr = `č.p. ${queryNumber}`
          addInfo(houseStr, {
            wasteType: 'Individuální svoz',
            dayName: area.svozovy_den || 'Čtvrtek',
            dates: getNextPickupDates(
              [
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
                19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34,
                35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
                51, 52, 53,
              ],
              area.svozovy_den || 'Čtvrtek',
              4
            ),
            description: area.popis,
            areaName: area.nazev,
          })
        }
      }
    })

    // Convert Map to Array
    return Array.from(foundMap.entries()).map(([streetName, schedules]) => ({
      streetName,
      schedules,
    }))
  }, [query, data])

  return (
    <div className='w-full max-w-3xl mx-auto p-4 space-y-6'>
      <div className='bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-8 border border-zinc-200 dark:border-zinc-700'>
        <h2 className='text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-100'>
          Kdy mi vyvezou odpad?
        </h2>
        <p className='text-zinc-600 dark:text-zinc-400 mb-6'>
          Zadejte název vaší ulice nebo číslo popisné (pro výjimky).
        </p>
        <div className='relative'>
          <input
            type='text'
            placeholder='Např. Myslivecká, 1710...'
            className='w-full p-4 text-lg border rounded-lg bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className='absolute right-4 top-4 text-zinc-400'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth={1.5}
              stroke='currentColor'
              className='w-6 h-6'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z'
              />
            </svg>
          </div>
        </div>
      </div>

      <div className='space-y-4'>
        {results.map((result) => (
          <div
            key={result.streetName}
            className='bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden'
          >
            <div className='bg-zinc-100/80 dark:bg-zinc-900/80 p-4 border-b border-zinc-200 dark:border-zinc-700 backdrop-blur-sm'>
              <h3 className='font-bold text-xl text-zinc-800 dark:text-zinc-200 flex items-center gap-2'>
                {result.streetName}
                <span className='text-xs font-normal px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'>
                  {result.schedules[0]?.areaName}
                </span>
              </h3>
            </div>
            <div className='p-4 grid gap-4 grid-cols-1 md:grid-cols-2'>
              {result.schedules.map((schedule, idx) => (
                <div
                  key={idx}
                  className='flex flex-col p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 hover:border-blue-200 dark:hover:border-blue-800/50 transition-colors'
                >
                  <div className='flex items-start justify-between mb-3'>
                    <span
                      className={`font-semibold px-2.5 py-1 rounded text-sm ${getBadgeColor(
                        schedule.wasteType
                      )}`}
                    >
                      {schedule.wasteType}
                    </span>
                    <span className='text-sm font-medium text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700'>
                      {schedule.dayName}
                    </span>
                  </div>

                  <div className='space-y-1.5 mb-2'>
                    {schedule.dates.length > 0 ? (
                      schedule.dates.map((date, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-2 ${
                            i === 0
                              ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                              : 'text-zinc-500 dark:text-zinc-500'
                          }`}
                        >
                          <span className='w-1.5 h-1.5 rounded-full bg-current opacity-60'></span>
                          {formatDate(date)}
                          {i === 0 && (
                            <span className='text-xs text-blue-600 dark:text-blue-400 font-medium ml-1'>
                              (Nejbližší)
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className='text-sm text-red-500'>
                        Termíny nenalezeny (zkontrolujte rok)
                      </span>
                    )}
                  </div>

                  {schedule.description && (
                    <p className='text-xs text-zinc-400 dark:text-zinc-500 mt-auto pt-2 border-t border-zinc-100 dark:border-zinc-700/50'>
                      {schedule.description.length > 60
                        ? schedule.description.substring(0, 60) + '...'
                        : schedule.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {query.length >= 2 && results.length === 0 && (
          <div className='text-center p-12 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 border-dashed'>
            <p className='text-zinc-500 text-lg'>
              Nenašli jsme žádnou ulici ani číslo popisné odpovídající zadání.
            </p>
            <p className='text-zinc-400 text-sm mt-2'>
              Zkuste zadat jen část názvu (např. "Mysl")
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function getBadgeColor(type: string) {
  if (type.includes('SKO') || type.includes('Směsný'))
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  if (type.includes('Plast'))
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800'
  if (type.includes('Papír'))
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
  if (type.includes('Sklo'))
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-800'
  if (type.includes('Sídliště'))
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800'
  return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300'
}
