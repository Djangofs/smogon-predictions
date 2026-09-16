import { useEffect, useMemo, useState } from 'react'
import './App.css'

type LeaderboardRow = {
  rank: number
  id: string
  name: string
  wins: number
  losses: number
  dif: number
  percentage: number
  raw?: string
  total?: number
}

type MatchupOption = {
  player: string
  predictions: number
  percentage: number
}

type MatchupPrediction = {
  week: number
  format: string
  matchup: string
  actualWinner: string | null
  totalPredictions: number
  winnerShare: number | null
  upset: 'Low' | 'Medium' | 'High' | null
  options: MatchupOption[]
}

type DataSet = {
  title: string
  weeks: number[]
  formats: string[]
  totalPredictors: number
  totalMatchups: number
  overallResults: LeaderboardRow[]
  weeklyResults: Record<string, LeaderboardRow[]>
  formatResults: Record<string, { all: LeaderboardRow[] }>
  matchupPredictions: MatchupPrediction[]
}

type ViewName = 'overview' | 'predictions'

const getActualWinnerPercentage = (matchup: MatchupPrediction) => {
  return matchup.options.find((option) => option.player === matchup.actualWinner)?.percentage ?? 0
}

const getUpsetValue = (matchup: MatchupPrediction) => {
  const favoriteShare = matchup.options[0].percentage
  if (matchup.actualWinner === null) {
    const runnerUpShare = matchup.options[1]?.percentage ?? 0
    return Math.max(0, favoriteShare - runnerUpShare)
  }
  return Math.max(0, favoriteShare - getActualWinnerPercentage(matchup))
}

const navItems: { id: ViewName; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'predictions', label: 'Predictions' },
]

function App() {
  const [data, setData] = useState<DataSet | null>(null)
  const [activeView, setActiveView] = useState<ViewName>('overview')
  const [selectedWeek, setSelectedWeek] = useState<string>('All')
  const [selectedFormat, setSelectedFormat] = useState<string>('All Formats')
  const [predictionSort, setPredictionSort] = useState('Biggest upset')

  useEffect(() => {
    void fetch('/data.b64')
      .then((response) => response.text())
      .then((base64) => {
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
        const json = new TextDecoder().decode(bytes)
        setData(JSON.parse(json) as DataSet)
      })
      .catch((error) => {
        console.error('Failed to load generated data', error)
      })
  }, [])

  const handleWeekChange = (value: string) => {
    setSelectedWeek(value)
    if (value !== 'All') setSelectedFormat('All Formats')
  }

  const handleFormatChange = (value: string) => {
    setSelectedFormat(value)
    if (value !== 'All Formats') setSelectedWeek('All')
  }

  const orderedOverallResults = useMemo(() => {
    if (!data) return []

    if (selectedFormat !== 'All Formats') return data.formatResults[selectedFormat]?.all ?? []
    if (selectedWeek !== 'All') return data.weeklyResults[selectedWeek] ?? []
    return data.overallResults
  }, [data, selectedFormat, selectedWeek])

  const avgAccuracy = useMemo(() => {
    if (orderedOverallResults.length === 0) return 0
    const total = orderedOverallResults.reduce((sum, row) => sum + row.percentage, 0)
    return Number((total / orderedOverallResults.length).toFixed(1))
  }, [orderedOverallResults])

  const sortedPredictionRows = useMemo(() => {
    if (!data) return []

    const rows = data.matchupPredictions.filter((matchup) => {
      if (selectedFormat !== 'All Formats' && matchup.format !== selectedFormat) return false
      if (selectedWeek !== 'All' && matchup.week !== Number(selectedWeek)) return false
      return true
    })

    if (predictionSort === 'Closest') {
      return [...rows].sort((a, b) => {
        const aGap = Math.abs(a.options[0].percentage - a.options[1].percentage)
        const bGap = Math.abs(b.options[0].percentage - b.options[1].percentage)
        return aGap - bGap
      })
    }

    if (predictionSort === 'Week') {
      return [...rows].sort((a, b) => {
        if (b.week !== a.week) return b.week - a.week
        return b.totalPredictions - a.totalPredictions
      })
    }

    return [...rows].sort((a, b) => getUpsetValue(b) - getUpsetValue(a))
  }, [data, predictionSort, selectedFormat, selectedWeek])

  if (!data) {
    return <div className="loading-shell">Loading tournament data…</div>
  }

  return (
    <div className="dashboard-shell">
      <header className="topbar">
        <div className="brand-block">
          <h1>{data.title}</h1>
        </div>

        <nav className="main-nav" aria-label="Main dashboard navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeView === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="page-shell">
        <section className="toolbar">
          <label className="control-group">
            <span>Week</span>
            <select value={selectedWeek} onChange={(event) => handleWeekChange(event.target.value)}>
              <option value="All">All Weeks</option>
              {data.weeks.map((week) => (
                <option key={week} value={String(week)}>
                  Week {week}
                </option>
              ))}
            </select>
          </label>

          <label className="control-group">
            <span>Format</span>
            <select value={selectedFormat} onChange={(event) => handleFormatChange(event.target.value)}>
              <option value="All Formats">All Formats</option>
              {data.formats.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </label>
        </section>

        {activeView === 'overview' && (
          <>
            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Predictors</div>
                <div className="stat-value">{orderedOverallResults.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Avg Accuracy</div>
                <div className="stat-value">{avgAccuracy}%</div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Overall leaderboard</h2>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Correct</th>
                    <th>Incorrect</th>
                    <th>Dif</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedOverallResults.map((row) => (
                    <tr key={row.id}>
                      <td>{row.rank}</td>
                      <td>{row.id}</td>
                      <td>{row.name}</td>
                      <td>{row.wins}</td>
                      <td>{row.losses}</td>
                      <td>{row.dif > 0 ? `+${row.dif}` : row.dif}</td>
                      <td>{row.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {activeView === 'predictions' && (
          <section className="panel">
            <div className="panel-header with-select">
              <h2>Prediction distribution</h2>
              <label className="control-group">
                <span>Order by:</span>
                <select value={predictionSort} onChange={(event) => setPredictionSort(event.target.value)}>
                  <option>Biggest upset</option>
                  <option>Closest</option>
                  <option>Week</option>
                </select>
              </label>
            </div>
            <table className="prediction-table">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Format</th>
                  <th>Matchup</th>
                  <th>Predicted split</th>
                  <th>Winner</th>
                </tr>
              </thead>
              <tbody>
                {sortedPredictionRows.map((matchup) => (
                  <tr key={`${matchup.week}-${matchup.format}-${matchup.matchup}`}>
                    <td>Week {matchup.week}</td>
                    <td>{matchup.format}</td>
                    <td>{matchup.matchup}</td>
                    <td className="distribution-cell">
                      <div className="prediction-list compact">
                        {matchup.options.map((option) => (
                          <div key={`${matchup.matchup}-${option.player}`} className="prediction-row">
                            <div className="label-row">
                              <span>{option.player}</span>
                              <strong>
                                {option.percentage}% ({option.predictions})
                              </strong>
                            </div>
                            <div className="bar-shell">
                              <div className="bar-fill" style={{ width: `${option.percentage}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>{matchup.actualWinner ?? 'Pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
