const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Validates a calendar date string in `YYYY-MM-DD` format.
 *
 * @param {unknown} val
 * @returns {boolean}
 */
export function isValidIsoDate(val) {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  const match = ISO_DATE_REGEX.exec(trimmed);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1980 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/**
 * Validates week/season/date-window options for weekly facts & preview generators.
 *
 * @param {Object} options
 */
export function validateWindowOptions(options = {}) {
  const { startDate, endDate, week, season } = options;

  if ((startDate && !endDate) || (!startDate && endDate)) {
    throw new Error('Both startDate and endDate must be provided together.');
  }

  if (startDate && endDate) {
    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD.');
    }
    if (startDate.trim() > endDate.trim()) {
      throw new Error('startDate must be on or before endDate.');
    }
  }

  if (week !== undefined && week !== null) {
    const w = Number(week);
    if (!Number.isInteger(w) || w < 1 || w > 25) {
      throw new Error('Invalid week number. Expected integer between 1 and 25.');
    }
  }

  if (season !== undefined && season !== null) {
    const s = Number(season);
    if (!Number.isInteger(s) || s < 1980 || s > 2100) {
      throw new Error('Invalid season year. Expected integer between 1980 and 2100.');
    }
  }
}
