import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputPath = path.join(rootDir, 'public', 'data.b64');

const findSourceFiles = () => {
  const predictionRoot = path.join(rootDir, 'data', 'predictions');
  const resultRoot = path.join(rootDir, 'data', 'results');
  const predictionFiles = [];
  const resultFiles = [];

  for (const folder of [predictionRoot, resultRoot]) {
    if (!fs.existsSync(folder)) continue;

    const entries = fs
      .readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(csv|txt)$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    for (const filename of entries) {
      const fullPath = path.join(folder, filename);
      if (folder === predictionRoot) predictionFiles.push(fullPath);
      if (folder === resultRoot) resultFiles.push(fullPath);
    }
  }

  const legacyPredictionRoot = path.join(rootDir, 'predictions');
  const legacyResultRoot = path.join(rootDir, 'results');
  const legacyPrediction = path.join(rootDir, 'data', 'predictions.csv');
  const legacyResults = path.join(rootDir, 'data', 'results.csv');

  if (predictionFiles.length === 0 && fs.existsSync(legacyPredictionRoot)) {
    predictionFiles.push(...fs.readdirSync(legacyPredictionRoot).filter((name) => /\.(csv|txt)$/i.test(name)).map((name) => path.join(legacyPredictionRoot, name)));
  }
  if (resultFiles.length === 0 && fs.existsSync(legacyResultRoot)) {
    resultFiles.push(...fs.readdirSync(legacyResultRoot).filter((name) => /\.(csv|txt)$/i.test(name)).map((name) => path.join(legacyResultRoot, name)));
  }
  if (predictionFiles.length === 0 && fs.existsSync(legacyPrediction)) predictionFiles.push(legacyPrediction);
  if (resultFiles.length === 0 && fs.existsSync(legacyResults)) resultFiles.push(legacyResults);

  return { predictionFiles, resultFiles };
};

const resolveWeekNumber = (sourceFile, fallbackValue) => {
  const basename = path.basename(sourceFile, path.extname(sourceFile));
  const match = basename.match(/(\d+)/);
  if (match) return Number(match[1]);

  const numericFallback = Number(fallbackValue ?? 0);
  return Number.isFinite(numericFallback) && numericFallback > 0 ? numericFallback : 1;
};

const detectDelimiter = (content) => {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return ',';

  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;

  if (tabCount > commaCount) return '\t';
  return ',';
};

const parseCsvLine = (line, delimiter = ',') => {
  const cells = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(value);
      value = '';
    } else {
      value += char;
    }
  }

  cells.push(value);
  return cells.map((cell) => cell.trim());
};

const parseCsv = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const delimiter = detectDelimiter(content);
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
};

const normalizeMatchup = (value) => String(value)
  .trim()
  .replace(/\bMt\.?\s*Silver\s*Foxes\b/gi, 'MSF')
  .replace(/\bMF\b/gi, 'MSF')
  .replace(/\bPower Plant Dynamos\b/gi, 'PD')
  .replace(/\bPPD\b/gi, 'PD')
  .replace(/\s+v\s+/gi, ' vs ')
  .replace(/\s+vs\s+/gi, ' vs ');

const stripBbCode = (value = '') => String(value)
  .replace(/\[\/?(?:b|u|i|s|url|img|color|size|quote|spoiler)[^\]]*\]/gi, '')
  .replace(/\[\/?.*?\]/g, '')
  .replace(/\[USER=\d+\]/gi, '')
  .replace(/\[\/USER\]/gi, '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const abbreviateTeamName = (teamName = '') => {
  const cleaned = String(teamName)
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[\-_/]+/g, ' ')
    .replace(/\./g, ' ')
    .trim();

  const normalized = cleaned
    .replace(/\bPower Plant Dynamos\b/gi, 'PD')
    .replace(/\bPPD\b/gi, 'PD')
    .replace(/\bMt\.?\s*Silver\s*Foxes\b/gi, 'MSF')
    .replace(/\bMF\b/gi, 'MSF');

  if (normalized === 'PD' || normalized === 'MSF' || normalized === 'IP') {
    return normalized.toUpperCase();
  }

  const words = normalized
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean)
    .filter((word) => !['the', 'of', 'and', 'for', 'vs', 'v'].includes(word.toLowerCase()));

  if (words.length === 0) return '';
  if (words.length === 1 && words[0].length > 1) return words[0].toUpperCase();

  const initials = words.map((word) => word[0]?.toUpperCase() ?? '').join('');
  if (initials.length > 0) return initials;
  return cleaned.slice(0, 2).toUpperCase();
};

const parseBbCodeResults = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = [];
  const slotCounts = new Map();
  const week = resolveWeekNumber(filePath);
  let currentMatchup = null;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = String(line).trim();
    if (!trimmed) continue;

    const teamMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9 .'-]+?)\s+\(\d+\)\s+vs\s+\(\d+\)\s+([A-Za-z][A-Za-z0-9 .'-]+?)$/);
    if (teamMatch) {
      const leftName = stripBbCode(teamMatch[1]);
      const rightName = stripBbCode(teamMatch[2]);
      currentMatchup = normalizeMatchup(`${abbreviateTeamName(leftName)} vs ${abbreviateTeamName(rightName)}`);
      continue;
    }

    const formatLine = trimmed.match(/^(SV\s+[A-Za-z0-9 ]+):\s*(.+)$/);
    if (!formatLine || !currentMatchup) continue;

    const format = formatLine[1].trim();
    const value = formatLine[2].trim();
    const slotKey = `${currentMatchup}|${format}`;
    const slot = (slotCounts.get(slotKey) ?? 0) + 1;
    slotCounts.set(slotKey, slot);

    const valueMatch = value.match(/(.+?)\s+vs\s+(.+)/i);
    const playerA = valueMatch ? stripBbCode(valueMatch[1]).trim() : '';
    const playerB = valueMatch ? stripBbCode(valueMatch[2]).trim() : '';
    const boldMatch = value.match(/\[B\](.*?)\[\/B\]/i);
    const winner = boldMatch ? stripBbCode(boldMatch[1]) : '';

    rows.push({
      Week: String(week),
      Format: format,
      Matchup: currentMatchup,
      Winner: winner,
      Slot: String(slot),
      Player1: playerA,
      Player2: playerB,
      __week: week,
      __slot: slot,
    });
  }

  return rows;
};

const parseResultFile = (filePath) => {
  if (/\.txt$/i.test(filePath)) return parseBbCodeResults(filePath);
  return parseCsv(filePath);
};

const parsePredictionHeader = (header) => {
  const trimmed = header.trim();
  const weekMatch = trimmed.match(/^(.+?)\s+(\d+)\s+\[(.+)\]$/);
  if (weekMatch) {
    return {
      format: weekMatch[1].trim(),
      slot: Number(weekMatch[2]),
      matchup: normalizeMatchup(weekMatch[3]),
    };
  }

  const fallbackMatch = trimmed.match(/^(.+?)\s+\[(.+)\]$/);
  if (fallbackMatch) {
    return {
      format: fallbackMatch[1].trim(),
      slot: 1,
      matchup: normalizeMatchup(fallbackMatch[2]),
    };
  }

  return null;
};

const formatPercentage = (value, total) => {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(1));
};

const buildLeaderboards = (predictorEntries) => {
  return predictorEntries
    .map((entry) => {
      const total = entry.wins + entry.losses;
      const percentage = total > 0 ? Number(((entry.wins / total) * 100).toFixed(1)) : 0;
      const dif = entry.wins - entry.losses;
      return {
        id: entry.id,
        name: entry.name,
        wins: entry.wins,
        losses: entry.losses,
        dif,
        percentage,
        total,
        raw: `${entry.wins}-${entry.losses}`,
      };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.dif !== a.dif) return b.dif - a.dif;
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      return a.name.localeCompare(b.name);
    })
    .map((entry, index) => ({
      rank: index + 1,
      id: entry.id,
      name: entry.name,
      wins: entry.wins,
      losses: entry.losses,
      dif: entry.dif,
      percentage: entry.percentage,
      total: entry.total,
      raw: entry.raw,
    }));
};

const { predictionFiles, resultFiles } = findSourceFiles();
const predictionRows = predictionFiles.flatMap((filePath) =>
  parseCsv(filePath).map((row) => ({ ...row, __week: resolveWeekNumber(filePath, row.Week ?? row['Week']) })),
);
const resultRows = resultFiles.flatMap((filePath) =>
  parseResultFile(filePath).map((row) => ({
    ...row,
    __week: resolveWeekNumber(filePath, row.Week ?? row['Week'] ?? row.__week),
    __slot: row.Slot ?? row['Slot'] ?? row.__slot ?? null,
  })),
);

const metadataColumns = new Set(['Username', 'User ID', 'Profile', 'Submitted', 'Discord username', 'Discord']);
const isMetadataColumn = (header) => {
  const normalized = String(header ?? '').trim();
  const lower = normalized.toLowerCase();
  return metadataColumns.has(normalized) || lower.includes('discord') || lower.includes('submitted') || lower.includes('profile') || lower.includes('username');
};
const predictionColumns = [...new Set(
  predictionRows.flatMap((row) => Object.keys(row).filter((header) => !isMetadataColumn(header))),
)];

const resultsMap = new Map();
const slotMatchupMap = new Map();
const slotPlayerMap = new Map();
for (const row of resultRows) {
  const weekValue = Number(row.Week ?? row.__week ?? 1);
  const format = String(row.Format ?? row['Format'] ?? '').trim();
  const matchup = normalizeMatchup(String(row.Matchup ?? row['Matchup'] ?? ''));
  const winner = String(row.Winner ?? row['Winner'] ?? '').trim();
  const slot = row.Slot ?? row['Slot'] ?? row.__slot ?? null;
  const playerA = String(row.Player1 ?? row['Player1'] ?? '').trim();
  const playerB = String(row.Player2 ?? row['Player2'] ?? '').trim();

  if (format && matchup) {
    const matchupKey = `${weekValue}|${format}|${matchup}`;
    if (winner) resultsMap.set(matchupKey, winner);

    if (slot !== null && slot !== undefined) {
      const slotKey = `${weekValue}|${format}|${matchup}|${slot}`;
      slotMatchupMap.set(slotKey, matchup);
      if (winner) resultsMap.set(slotKey, winner);

      if (playerA && playerB) {
        slotPlayerMap.set(slotKey, { playerA, playerB });
      }
    }
  }
}

const predictorMap = new Map();
const matchupCounts = new Map();
const weeklyPredictors = new Map();
const formatPredictors = new Map();

for (const row of predictionRows) {
  const id = row['User ID'] || row['Username'];
  const name = row.Username || row['User ID'];

  if (!predictorMap.has(id)) {
    predictorMap.set(id, {
      id,
      name,
      wins: 0,
      losses: 0,
      weekly: {},
      formats: {},
    });
  }

  const entry = predictorMap.get(id);

  for (const header of predictionColumns) {
    const parsed = parsePredictionHeader(header);
    if (!parsed) continue;

    const value = String(row[header] ?? '').trim();
    if (!value) continue;

    const weekNumber = Number(parsed.week ?? row.__week ?? 1);
    const slotKey = parsed.slot ? `${weekNumber}|${parsed.format}|${parsed.matchup}|${parsed.slot}` : null;
    const matchupKey = `${weekNumber}|${parsed.format}|${parsed.matchup}`;
    const actualMatchup = slotKey ? slotMatchupMap.get(slotKey) : null;
    if (slotKey && actualMatchup && actualMatchup !== parsed.matchup) {
      continue;
    }

    const normalizedValue = value.trim();
    const matchupBucket = matchupCounts.get(slotKey ?? matchupKey) ?? {};
    matchupBucket[normalizedValue] = (matchupBucket[normalizedValue] ?? 0) + 1;
    matchupCounts.set(slotKey ?? matchupKey, matchupBucket);

    const actualWinner = resultsMap.get(slotKey) ?? resultsMap.get(matchupKey);
    if (!actualWinner) continue;

    const isCorrect = normalizedValue === actualWinner;

    if (isCorrect) {
      entry.wins += 1;
      entry.weekly[weekNumber] = { ...(entry.weekly[weekNumber] ?? { wins: 0, losses: 0 }), wins: (entry.weekly[weekNumber]?.wins ?? 0) + 1 };
      entry.formats[parsed.format] = { ...(entry.formats[parsed.format] ?? { wins: 0, losses: 0 }), wins: (entry.formats[parsed.format]?.wins ?? 0) + 1 };
    } else {
      entry.losses += 1;
      entry.weekly[weekNumber] = { ...(entry.weekly[weekNumber] ?? { wins: 0, losses: 0 }), losses: (entry.weekly[weekNumber]?.losses ?? 0) + 1 };
      entry.formats[parsed.format] = { ...(entry.formats[parsed.format] ?? { wins: 0, losses: 0 }), losses: (entry.formats[parsed.format]?.losses ?? 0) + 1 };
    }

    weeklyPredictors.set(weekNumber, (weeklyPredictors.get(weekNumber) ?? new Map()));
    const weekBucket = weeklyPredictors.get(weekNumber);
    if (!weekBucket.has(id)) {
      weekBucket.set(id, { id, name, wins: 0, losses: 0 });
    }
    const weekEntry = weekBucket.get(id);
    if (isCorrect) weekEntry.wins += 1; else weekEntry.losses += 1;

    formatPredictors.set(parsed.format, (formatPredictors.get(parsed.format) ?? new Map()));
    const formatBucket = formatPredictors.get(parsed.format);
    if (!formatBucket.has(id)) {
      formatBucket.set(id, { id, name, wins: 0, losses: 0 });
    }
    const formatEntry = formatBucket.get(id);
    if (isCorrect) formatEntry.wins += 1; else formatEntry.losses += 1;
  }
}

const predictorEntries = [...predictorMap.values()].filter((entry) => (entry.wins + entry.losses) > 0);
const overallResults = buildLeaderboards(predictorEntries).map((entry) => ({
  ...entry,
  raw: entry.raw,
}));

const weeks = [...new Set(resultRows.map((row) => Number(row.Week ?? row.__week ?? 1)))].sort((a, b) => a - b);
const formats = [...new Set(resultRows.map((row) => row.Format))];

const weeklyResults = Object.fromEntries(
  weeks.map((week) => {
    const weekEntries = [...(weeklyPredictors.get(week) ?? new Map()).values()];
    return [String(week), buildLeaderboards(weekEntries)];
  }),
);

const formatResults = Object.fromEntries(
  formats.map((format) => {
    const formatEntries = [...(formatPredictors.get(format) ?? new Map()).values()];
    return [format, { all: buildLeaderboards(formatEntries) }];
  }),
);

const matchupPredictions = [];
for (const [key, values] of matchupCounts.entries()) {
  const [week, format, matchup, slot] = key.split('|');
  const players = Object.entries(values).map(([player, count]) => ({
    player,
    predictions: count,
    percentage: formatPercentage(count, Object.values(values).reduce((sum, value) => sum + value, 0)),
  }));

  const totalPredictions = players.reduce((sum, player) => sum + player.predictions, 0);
  const popular = players.sort((a, b) => b.percentage - a.percentage)[0];
  const actualWinner = resultsMap.get(key) ?? null;
  const actualPlayers = slotPlayerMap.get(key) ?? null;
  const displayPlayers = actualPlayers ? `${actualPlayers.playerA} vs ${actualPlayers.playerB}` : normalizeMatchup(matchup);

  let winnerShare = null;
  let upset = null;
  if (actualWinner) {
    const actualShare = players.find((player) => player.player === actualWinner)?.percentage ?? 0;
    const favoriteShare = popular?.percentage ?? 0;
    const upsetValue = Math.max(0, favoriteShare - actualShare);
    winnerShare = actualShare;
    upset = 'Low';
    if (upsetValue >= 35) upset = 'High';
    else if (upsetValue >= 15) upset = 'Medium';
  }

  matchupPredictions.push({
    week: Number(week),
    format,
    matchup: displayPlayers,
    slot: slot ? Number(slot) : null,
    actualWinner,
    totalPredictions,
    winnerShare,
    upset,
    options: players.sort((a, b) => b.percentage - a.percentage),
  });
}

matchupPredictions.sort((a, b) => {
  if (b.totalPredictions !== a.totalPredictions) return b.totalPredictions - a.totalPredictions;
  return a.matchup.localeCompare(b.matchup);
});

const generatedData = {
  title: 'SCL VI Prediction Tournament',
  weeks,
  formats,
  totalPredictors: predictorEntries.length,
  totalMatchups: matchupPredictions.length,
  overallResults,
  weeklyResults,
  formatResults,
  matchupPredictions,
};

const encodedPayload = Buffer.from(JSON.stringify(generatedData), 'utf-8').toString('base64');
fs.writeFileSync(outputPath, encodedPayload);
console.log(`Generated ${outputPath} with ${predictorEntries.length} predictors and ${matchupPredictions.length} matchup summaries.`);
