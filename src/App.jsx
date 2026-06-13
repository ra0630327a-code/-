import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, Dumbbell, Calendar, ChevronDown, ChevronUp, X, TrendingUp, BarChart3, ListChecks } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const STORAGE_KEY = "workout_logs_v1";
const EXERCISES_KEY = "workout_exercises_v1";

const DEFAULT_EXERCISES = ["ベンチプレス", "スクワット", "デッドリフト", "懸垂"];

function loadLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveLogs(logs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(logs)); } catch {}
}
function loadExercises() {
  try {
    const raw = localStorage.getItem(EXERCISES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_EXERCISES;
  } catch {
    return DEFAULT_EXERCISES;
  }
}
function saveExercises(list) {
  try { localStorage.setItem(EXERCISES_KEY, JSON.stringify(list)); } catch {}
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const WEIGHT_OPTIONS = Array.from({ length: 97 }, (_, i) => Math.round(i * 2.5 * 10) / 10); // 0 - 240kg, 2.5刻み
const REPS_OPTIONS = Array.from({ length: 51 }, (_, i) => i + 1); // 1 - 50
const SETS_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1); // 1 - 20

function WheelPicker({ value, onChange, options, label, unit }) {
  const itemHeight = 40;
  const containerRef = useRef(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  const currentIndex = options.indexOf(value);

  // 値が変わったら表示位置を同期（外部からの変更時）
  useEffect(() => {
    const el = containerRef.current;
    if (!el || isScrollingRef.current) return;
    const idx = options.indexOf(value);
    if (idx >= 0) {
      el.scrollTop = idx * itemHeight;
    }
  }, [value, options]);

  // 初期スクロール位置設定
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const idx = options.indexOf(value);
    el.scrollTop = (idx >= 0 ? idx : 0) * itemHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = () => {
    isScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / itemHeight);
      const clamped = Math.max(0, Math.min(options.length - 1, idx));
      el.scrollTo({ top: clamped * itemHeight, behavior: "smooth" });
      const newVal = options[clamped];
      if (newVal !== value) onChange(newVal);
      isScrollingRef.current = false;
    }, 100);
  };

  return (
    <div>
      <label className="text-xs text-stone-400 mb-1 block text-center">{label}</label>
      <div className="relative border border-stone-200 rounded-lg bg-white overflow-hidden" style={{ height: itemHeight * 3 }}>
        {/* 中央のハイライト枠 */}
        <div
          className="absolute left-1 right-1 top-1/2 -translate-y-1/2 bg-emerald-50 border border-emerald-200 rounded-md pointer-events-none z-0"
          style={{ height: itemHeight }}
        />
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="relative h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          <div style={{ height: itemHeight }} />
          {options.map((opt) => (
            <div
              key={opt}
              className={`flex items-center justify-center snap-center transition-colors ${
                opt === value ? "text-stone-900 font-bold text-lg" : "text-stone-400 text-sm"
              }`}
              style={{ height: itemHeight }}
            >
              {opt}{unit}
            </div>
          ))}
          <div style={{ height: itemHeight }} />
        </div>
      </div>
    </div>
  );
}

export default function WorkoutApp() {
  const [view, setView] = useState("log"); // "log" | "chart"
  const [logs, setLogs] = useState([]);
  const [exercises, setExercises] = useState(DEFAULT_EXERCISES);
  const [selectedExercise, setSelectedExercise] = useState(DEFAULT_EXERCISES[0]);
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(10);
  const [sets, setSets] = useState(3);
  const [date, setDate] = useState(todayStr());
  const [expandedDates, setExpandedDates] = useState({});
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");

  useEffect(() => {
    setLogs(loadLogs());
    const ex = loadExercises();
    setExercises(ex);
    if (ex.length > 0) setSelectedExercise(ex[0]);
  }, []);

  const handleAdd = () => {
    const entry = {
      id: `e_${Date.now()}`,
      date,
      exercise: selectedExercise,
      weight,
      reps,
      sets,
      createdAt: Date.now(),
    };
    const updated = [entry, ...logs];
    setLogs(updated);
    saveLogs(updated);
  };

  const handleDelete = (id) => {
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    saveLogs(updated);
  };

  const handleAddExercise = () => {
    const name = newExerciseName.trim();
    if (!name || exercises.includes(name)) {
      setNewExerciseName("");
      setShowAddExercise(false);
      return;
    }
    const updated = [...exercises, name];
    setExercises(updated);
    saveExercises(updated);
    setSelectedExercise(name);
    setNewExerciseName("");
    setShowAddExercise(false);
  };

  const handleDeleteExercise = (name) => {
    if (exercises.length <= 1) return;
    const updated = exercises.filter((e) => e !== name);
    setExercises(updated);
    saveExercises(updated);
    if (selectedExercise === name) setSelectedExercise(updated[0]);
  };

  // 日付ごとにグループ化
  const groupedByDate = useMemo(() => {
    const groups = {};
    for (const log of logs) {
      if (!groups[log.date]) groups[log.date] = [];
      groups[log.date].push(log);
    }
    return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [logs]);

  // 種目ごとの最新の最大重量(参考表示)
  const bestWeights = useMemo(() => {
    const best = {};
    for (const log of logs) {
      if (!best[log.exercise] || log.weight > best[log.exercise]) {
        best[log.exercise] = log.weight;
      }
    }
    return best;
  }, [logs]);

  const [chartExercise, setChartExercise] = useState(null);

  useEffect(() => {
    if (chartExercise === null && exercises.length > 0) setChartExercise(exercises[0]);
  }, [exercises, chartExercise]);

  // グラフ用データ: 日付ごとに最大重量・その時のセット数・回数を抽出
  const chartData = useMemo(() => {
    if (!chartExercise) return [];
    const byDate = {};
    for (const log of logs) {
      if (log.exercise !== chartExercise) continue;
      const existing = byDate[log.date];
      if (!existing || log.weight > existing.weight) {
        byDate[log.date] = { weight: log.weight, sets: log.sets, reps: log.reps };
      }
    }
    return Object.entries(byDate)
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([date, v]) => ({
        date: new Date(date + "T00:00:00").toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }),
        fullDate: date,
        weight: v.weight,
        sets: v.sets,
        reps: v.reps,
      }));
  }, [logs, chartExercise]);

  const toggleDate = (date) => {
    setExpandedDates((prev) => ({ ...prev, [date]: !prev[date] }));
  };

  const formatDateLabel = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - d) / (1000 * 60 * 60 * 24));
    const label = d.toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" });
    if (diffDays === 0) return `今日 (${label})`;
    if (diffDays === 1) return `昨日 (${label})`;
    return label;
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-8">
      {/* ヘッダー */}
      <header className="bg-white border-b border-stone-200 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold flex items-center gap-2 text-stone-800 mb-3">
          <Dumbbell className="w-5 h-5 text-emerald-700" />
          トレーニング記録
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setView("log")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === "log" ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-500"
            }`}
          >
            <ListChecks className="w-4 h-4" />
            記録
          </button>
          <button
            onClick={() => setView("chart")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === "chart" ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-500"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            グラフ
          </button>
        </div>
      </header>

      {view === "chart" ? (
        <main className="px-4 py-4 max-w-md mx-auto">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {exercises.map((ex) => (
              <button
                key={ex}
                onClick={() => setChartExercise(ex)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  chartExercise === ex
                    ? "bg-emerald-700 text-white border-emerald-700"
                    : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                }`}
              >
                {ex}
              </button>
            ))}
          </div>

          {chartData.length === 0 ? (
            <p className="text-center text-sm text-stone-400 py-12">
              「{chartExercise}」の記録がまだありません。
            </p>
          ) : (
            <div className="space-y-6">
              {/* 最大重量の推移 */}
              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                  最大重量の推移 (kg)
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#78716c" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#78716c" }} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e5e4" }}
                      formatter={(value, name) => [name === "weight" ? `${value}kg` : value, name === "weight" ? "最大重量" : name]}
                    />
                    <Line type="monotone" dataKey="weight" stroke="#047857" strokeWidth={2} dot={{ r: 3 }} name="最大重量" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* セット数・回数の推移 */}
              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-emerald-700" />
                  セット数・回数の推移（最大重量時）
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#78716c" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#78716c" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e5e4" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="sets" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="セット数" />
                    <Line type="monotone" dataKey="reps" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} name="回数" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* サマリー */}
              <div className="bg-white border border-stone-200 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-stone-400 mb-1">最高重量</p>
                  <p className="text-lg font-bold text-stone-800">{Math.max(...chartData.map((d) => d.weight))}kg</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-1">記録日数</p>
                  <p className="text-lg font-bold text-stone-800">{chartData.length}日</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-1">直近の重量</p>
                  <p className="text-lg font-bold text-stone-800">{chartData[chartData.length - 1].weight}kg</p>
                </div>
              </div>
            </div>
          )}
        </main>
      ) : (
      <div>

      <section className="bg-white border-b border-stone-200 px-4 py-4">
        <div className="space-y-3 max-w-md mx-auto">
          {/* 日付 */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-stone-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          {/* 種目選択 */}
          <div className="flex items-center gap-2 flex-wrap">
            {exercises.map((ex) => (
              <button
                key={ex}
                onClick={() => setSelectedExercise(ex)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selectedExercise === ex
                    ? "bg-emerald-700 text-white border-emerald-700"
                    : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                }`}
              >
                {ex}
              </button>
            ))}
            <button
              onClick={() => setShowAddExercise(true)}
              className="px-2.5 py-1.5 rounded-full text-sm font-medium border border-dashed border-stone-300 text-stone-400 hover:text-stone-600 hover:border-stone-400 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              種目追加
            </button>
          </div>

          {bestWeights[selectedExercise] !== undefined && (
            <p className="text-xs text-stone-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              これまでの最高記録: {bestWeights[selectedExercise]}kg
            </p>
          )}

          {/* kg / 回数 / セット入力 */}
          <div className="grid grid-cols-3 gap-2">
            <WheelPicker value={weight} onChange={setWeight} options={WEIGHT_OPTIONS} label="重量" unit="kg" />
            <WheelPicker value={reps} onChange={setReps} options={REPS_OPTIONS} label="回数" unit="回" />
            <WheelPicker value={sets} onChange={setSets} options={SETS_OPTIONS} label="セット" unit="セット" />
          </div>

          <button
            onClick={handleAdd}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            記録を追加
          </button>
        </div>
      </section>

      {/* 履歴 */}
      <main className="px-4 py-4 max-w-md mx-auto">
        {groupedByDate.length === 0 ? (
          <p className="text-center text-sm text-stone-400 py-12">
            まだ記録がありません。上のフォームから最初の記録を追加してください。
          </p>
        ) : (
          <div className="space-y-3">
            {groupedByDate.map(([d, items]) => {
              const expanded = expandedDates[d] !== false; // デフォルト展開
              const totalVolume = items.reduce((sum, i) => sum + i.weight * i.reps * i.sets, 0);
              return (
                <div key={d} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleDate(d)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50"
                  >
                    <div className="text-left">
                      <p className="font-semibold text-sm text-stone-800">{formatDateLabel(d)}</p>
                      <p className="text-xs text-stone-400">{items.length}種目・総量 {totalVolume.toLocaleString()}kg</p>
                    </div>
                    {expanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                  </button>

                  {expanded && (
                    <div className="border-t border-stone-100">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-2.5 border-b border-stone-50 last:border-b-0">
                          <div>
                            <p className="text-sm font-medium text-stone-800">{item.exercise}</p>
                            <p className="text-xs text-stone-500 mt-0.5">
                              {item.weight}kg × {item.reps}回 × {item.sets}セット
                            </p>
                          </div>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-stone-300 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      </div>
      )}

      {/* 種目追加モーダル */}
      {showAddExercise && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddExercise(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-stone-800">種目を管理</h3>
              <button onClick={() => setShowAddExercise(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {exercises.map((ex) => (
                <div key={ex} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                  <span className="text-sm">{ex}</span>
                  <button
                    onClick={() => handleDeleteExercise(ex)}
                    disabled={exercises.length <= 1}
                    className="text-stone-300 hover:text-red-500 disabled:opacity-30 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                value={newExerciseName}
                onChange={(e) => setNewExerciseName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddExercise()}
                placeholder="新しい種目名（例: ラットプルダウン）"
                className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
              <button
                onClick={handleAddExercise}
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-lg text-sm font-medium"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
