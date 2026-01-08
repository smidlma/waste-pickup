export const daysMap: Record<string, number> = {
  Pondělí: 1,
  Úterý: 2,
  Středa: 3,
  Čtvrtek: 4,
  Pátek: 5,
  Sobota: 6,
  Neděle: 0, // 0 for Sunday in JS Date.getDay()
}

export const getWeekNumber = (d: Date): number => {
  // Copy date so don't modify original
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  // Get first day of year
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  )
  return weekNo
}

export const getNextPickupDates = (
  weeks: number[] | 'sudé' | 'liché',
  dayOfWeekName: string,
  numberOfDates: number = 3
): Date[] => {
  const today = new Date() // Or use a fixed date for testing if needed
  // Reset time to start of day to compare correctly
  today.setHours(0, 0, 0, 0)

  const dayIndex = daysMap[dayOfWeekName]

  if (dayIndex === undefined) return []

  const dates: Date[] = []

  // Find closest previous Monday to start iterating from (to align with ISO weeks)
  let searchDate = new Date(today)
  let currentJsDay = searchDate.getDay()
  // If today is Monday(1), subtract 0. If Sunday(0), subtract 6.
  let daysToSubtract = currentJsDay === 0 ? 6 : currentJsDay - 1
  searchDate.setDate(searchDate.getDate() - daysToSubtract)

  let count = 0
  // Safety limit of 100 weeks to prevent infinite loops
  let safetyCounter = 0

  while (count < numberOfDates && safetyCounter < 100) {
    safetyCounter++

    // Calculate the actual target date for this week based on the day name
    // The searchDate is always a Monday.
    let targetDate = new Date(searchDate)

    // Calculate offset from Monday (1)
    // dayIndex: Mon=1...Sun=0
    // We want offset 0 for Mon(1), 1 for Tue(2)... 6 for Sun(0)
    let offset = dayIndex - 1
    if (dayIndex === 0) offset = 6

    targetDate.setDate(targetDate.getDate() + offset)

    // Check rule
    // We need the week number of this specific target date (or ANY day in this week, since ISO weeks are Mon-Sun)
    const weekNum = getWeekNumber(targetDate)

    let isMatch = false

    if (weeks === 'sudé') {
      if (weekNum % 2 === 0) isMatch = true
    } else if (weeks === 'liché') {
      if (weekNum % 2 !== 0) isMatch = true
    } else if (Array.isArray(weeks)) {
      if (weeks.includes(weekNum)) isMatch = true
    }

    // Only add if it's today or in the future
    if (isMatch && targetDate >= today) {
      dates.push(new Date(targetDate))
      count++
    }

    // Move to next week
    searchDate.setDate(searchDate.getDate() + 7)
  }

  return dates
}

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(date)
}
