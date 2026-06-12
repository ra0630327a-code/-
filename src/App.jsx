import { useState, useRef, useEffect, useMemo } from "react";
import {
  Mic, Square, Download, Trash2, FileText, Clock, Pencil,
  Star, Search, FolderOpen, Plus, X, FileDown, Layers
} from "lucide-react";

const STORAGE_KEY = "minutes_sessions_v1";

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

export default function MinutesApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [notes, setNotes] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [title, setTitle] = useState("無題の議事録");
  const [error, setError] = useState("");
  const [bookmarks, setBookmarks] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  useEffect(() => {
    if (isRecording) return;
    if (!transcript && !notes && elapsed === 0) return;

    const timeout = setTimeout(() => {
      const id = sessionId || `s_${Date.now()}`;
      const record = {
        id, title, notes, transcript, elapsed, bookmarks,
        updatedAt: Date.now(),
      };
      const list = loadSessions();
      const idx = list.findIndex((s) => s.id === id);
      if (idx >= 0) list[idx] = record;
      else list.unshift(record);
      saveSessions(list);
      setSessions(list);
      if (!sessionId) setSessionId(id);
    }, 800);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, notes, transcript, elapsed, bookmarks, isRecording]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interim]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    setError("");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("このブラウザは音声認識に対応していません（Chrome推奨）。録音のみ行います。");
    } else {
      const recognition = new SpeechRecognition();
      recognition.lang = "ja-JP";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += text;
          else interimText += text;
        }
        if (finalText) setTranscript((prev) => prev + finalText + "\n");
        setInterim(interimText);
      };

      recognition.onerror = (event) => {
        if (event.error !== "no-speech") setError(`音声認識エラー: ${event.error}`);
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
      try { recognition.start(); } catch (e) { setError("音声認識を開始できませんでした。"); }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    } catch (e) {
      setError((prev) => (prev ? prev + " " : "") + "マイクへのアクセスが許可されていません。");
    }

    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    isRecordingRef.current = true;
    setIsRecording(true);
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setInterim("");

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleNewSession = () => {
    if (isRecording) stopRecording();
    setSessionId(null);
    setTitle("無題の議事録");
    setTranscript("");
    setInterim("");
    setNotes("");
    setElapsed(0);
    setAudioUrl(null);
    setError("");
    setBookmarks([]);
    setShowLibrary(false);
  };

  const handleDeleteCurrent = () => {
    if (isRecording) stopRecording();
    if (sessionId) {
      const list = loadSessions().filter((s) => s.id !== sessionId);
      saveSessions(list);
      setSessions(list);
    }
    handleNewSession();
  };

  const openSession = (s) => {
    if (isRecording) stopRecording();
    setSessionId(s.id);
    setTitle(s.title);
    setNotes(s.notes || "");
    setTranscript(s.transcript || "");
    setInterim("");
    setElapsed(s.elapsed || 0);
    setBookmarks(s.bookmarks || []);
    setAudioUrl(null);
    setShowLibrary(false);
  };

  const deleteSessionFromLibrary = (id, e) => {
    e.stopPropagation();
    const list = loadSessions().filter((s) => s.id !== id);
    saveSessions(list);
    setSessions(list);
    if (id === sessionId) handleNewSession();
  };

  const insertSectionBreak = (label) => {
    const stamp = `\n--- ${label} [${formatTime(elapsed)}] ---\n`;
    setNotes((prev) => prev + (prev && !prev.endsWith("\n") ? "\n" : "") + stamp);
  };

  const insertTimestampNote = () => {
    const stamp = `[${formatTime(elapsed)}] `;
    setNotes((prev) => prev + (prev && !prev.endsWith("\n") ? "\n" : "") + stamp);
  };

  const addBookmark = () => {
    const label = (interim || "").trim() || "（重要発言）";
    setBookmarks((prev) => [...prev, { time: elapsed, label, addedAt: Date.now() }]);
    setNotes((prev) => prev + (prev && !prev.endsWith("\n") ? "\n" : "") + `★ [${formatTime(elapsed)}] 重要発言マーク\n`);
  };

  const removeBookmark = (idx) => {
    setBookmarks((prev) => prev.filter((_, i) => i !== idx));
  };

  const noteCharCount = notes.length;
  const transcriptCharCount = transcript.length;

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        (s.title || "").toLowerCase().includes(q) ||
        (s.notes || "").toLowerCase().includes(q) ||
        (s.transcript || "").toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  const highlightMatch = (text, query) => {
    if (!query.trim()) return null;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return null;
    const start = Math.max(0, idx - 15);
    const end = Math.min(text.length, idx + query.length + 25);
    return (
      <>
        {start > 0 && "…"}
        {text.slice(start, idx)}
        <mark className="bg-amber-200 text-stone-900 rounded px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length, end)}
        {end < text.length && "…"}
      </>
    );
  };

  const buildContent = () => {
    const now = new Date();
    const dateStr = now.toLocaleString("ja-JP");
    const bookmarkLines = bookmarks.length > 0
      ? bookmarks.map((b) => `- [${formatTime(b.time)}] ${b.label}`).join("\n")
      : "(なし)";

    return `# ${title}\n\n記録日時: ${dateStr}\n録音時間: ${formatTime(elapsed)}\n\n## 重要発言ブックマーク\n\n${bookmarkLines}\n\n## メモ・要点\n\n${notes || "(なし)"}\n\n## 音声文字起こし\n\n${transcript || "(なし)"}\n`;
  };

  const handleExportTxt = () => {
    const content = buildContent();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[\\/:*?"<>|]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    setError("");
    try {
      if (!window.docx) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/docx.min.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("docxライブラリの読み込みに失敗しました"));
          document.head.appendChild(script);
        });
      }

      const {
        Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        LevelFormat, BorderStyle,
      } = window.docx;

      const now = new Date();
      const dateStr = now.toLocaleString("ja-JP");
      const children = [];

      children.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [new TextRun({ text: title, font: "Arial" })],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `記録日時: ${dateStr}　/　録音時間: ${formatTime(elapsed)}`, font: "Arial", size: 20, color: "666666" }),
          ],
          spacing: { after: 240 },
        })
      );

      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "重要発言ブックマーク", font: "Arial" })] })
      );
      if (bookmarks.length > 0) {
        bookmarks.forEach((b) => {
          children.push(
            new Paragraph({
              numbering: { reference: "bullets", level: 0 },
              children: [
                new TextRun({ text: `[${formatTime(b.time)}] `, bold: true, font: "Arial" }),
                new TextRun({ text: b.label, font: "Arial" }),
              ],
            })
          );
        });
      } else {
        children.push(new Paragraph({ children: [new TextRun({ text: "(なし)", italics: true, font: "Arial", color: "999999" })] }));
      }

      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "メモ・要点", font: "Arial" })], spacing: { before: 240 } })
      );
      const noteLines = (notes || "(なし)").split("\n");
      noteLines.forEach((line) => {
        if (line.startsWith("--- ") && line.endsWith(" ---")) {
          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E75B6", space: 1 } },
              children: [new TextRun({ text: line.replace(/^--- | ---$/g, ""), font: "Arial" })],
              spacing: { before: 200, after: 100 },
            })
          );
        } else if (line.trim() === "") {
          children.push(new Paragraph({ children: [] }));
        } else {
          children.push(new Paragraph({ children: [new TextRun({ text: line, font: "Arial" })] }));
        }
      });

      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "音声文字起こし", font: "Arial" })], spacing: { before: 240 } })
      );
      const transcriptLines = (transcript || "(なし)").split("\n").filter((l) => l !== "");
      if (transcriptLines.length === 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: "(なし)", italics: true, font: "Arial", color: "999999" })] }));
      } else {
        transcriptLines.forEach((line) => {
          children.push(new Paragraph({ children: [new TextRun({ text: line, font: "Arial", size: 22, color: "333333" })], spacing: { after: 80 } }));
        });
      }

      const doc = new Document({
        styles: {
          default: { document: { run: { font: "Arial", size: 24 } } },
          paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
              run: { size: 32, bold: true, font: "Arial", color: "1A1A1A" },
              paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
              run: { size: 26, bold: true, font: "Arial", color: "2E75B6" },
              paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 1 } },
          ],
        },
        numbering: {
          config: [
            { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
          ],
        },
        sections: [{
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[\\/:*?"<>|]/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Word形式での出力に失敗しました: " + e.message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      <header className="border-b border-stone-200 bg-white px-4 py-3 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none outline-none focus:ring-2 focus:ring-emerald-200 rounded px-1 -ml-1 w-full sm:w-64 truncate"
            aria-label="議事録タイトル"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-stone-500 font-mono text-sm tabular-nums">
            <Clock className="w-4 h-4" />
            {formatTime(elapsed)}
          </div>

          {!isRecording ? (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Mic className="w-4 h-4" />
              録音開始
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors animate-pulse"
            >
              <Square className="w-4 h-4" />
              停止
            </button>
          )}

          {isRecording && (
            <button
              onClick={addBookmark}
              className="flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              title="現在の発言を重要としてマーク"
            >
              <Star className="w-4 h-4" />
              <span className="hidden sm:inline">重要マーク</span>
            </button>
          )}

          <div className="relative group">
            <button className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">保存</span>
            </button>
            <div className="absolute right-0 mt-1 w-44 bg-white border border-stone-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-20">
              <button onClick={handleExportTxt} className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center gap-2">
                <FileText className="w-4 h-4 text-stone-400" />
                テキスト (.txt)
              </button>
              <button onClick={handleExportDocx} disabled={isExportingDocx} className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center gap-2 disabled:opacity-50">
                <FileDown className="w-4 h-4 text-blue-500" />
                {isExportingDocx ? "出力中..." : "Word (.docx)"}
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowLibrary(true)}
            className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            title="過去の議事録を開く"
          >
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">履歴</span>
          </button>

          <button
            onClick={handleNewSession}
            className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            title="新規作成"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            onClick={handleDeleteCurrent}
            className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-500 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            title="この議事録を削除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-amber-50 text-amber-800 text-sm px-4 sm:px-6 py-2 border-b border-amber-200">
          {error}
        </div>
      )}

      {audioUrl && !isRecording && (
        <div className="bg-white border-b border-stone-200 px-4 sm:px-6 py-2 flex items-center gap-3">
          <span className="text-sm text-stone-500 shrink-0">録音音声:</span>
          <audio controls src={audioUrl} className="w-full max-w-md" />
        </div>
      )}

      {bookmarks.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-amber-700 flex items-center gap-1 shrink-0">
              <Star className="w-3.5 h-3.5" />
              重要発言:
            </span>
            {bookmarks.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-white border border-amber-200 rounded-full px-2 py-0.5 text-xs text-amber-800">
                {formatTime(b.time)}
                <button onClick={() => removeBookmark(i)} className="text-amber-400 hover:text-amber-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-px bg-stone-200">
        <section className="bg-white p-4 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-emerald-700" />
              メモ・要点
            </h2>
            <div className="flex items-center gap-2">
              {isRecording && (
                <>
                  <button
                    onClick={() => insertSectionBreak("セクション")}
                    className="text-xs text-stone-600 hover:text-stone-900 font-medium border border-stone-200 rounded px-2 py-1 flex items-center gap-1"
                    title="新しいセクションの区切りを挿入"
                  >
                    <Layers className="w-3 h-3" />
                    区切り挿入
                  </button>
                  <button
                    onClick={insertTimestampNote}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-medium border border-emerald-200 rounded px-2 py-1"
                  >
                    + 時刻挿入
                  </button>
                </>
              )}
              <span className="text-xs text-stone-400 tabular-nums">{noteCharCount}文字</span>
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="講演を聞きながら、要点・キーワード・気づきなどを自由に入力してください。&#10;録音中は上部のボタンでタイムスタンプやセクション区切りを挿入できます。"
            className="flex-1 min-h-[300px] resize-none border border-stone-200 rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300"
          />
        </section>

        <section className="bg-white p-4 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
              <Mic className="w-4 h-4 text-stone-400" />
              音声文字起こし（自動）
            </h2>
            <span className="text-xs text-stone-400 tabular-nums">{transcriptCharCount}文字</span>
          </div>
          <div className="flex-1 min-h-[300px] border border-stone-200 rounded-lg p-3 text-sm leading-relaxed overflow-y-auto bg-stone-50 whitespace-pre-wrap">
            {transcript || interim ? (
              <>
                <span>{transcript}</span>
                <span className="text-stone-400">{interim}</span>
              </>
            ) : (
              <span className="text-stone-400">
                録音を開始すると、話した内容が自動でここに文字として表示されます。
              </span>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </section>
      </main>

      <footer className="text-center text-xs text-stone-400 py-3 border-t border-stone-200 bg-white">
        音声認識はChromeなどのブラウザのWeb Speech APIを利用しています。マイクへのアクセスを許可してください。データはこのブラウザ内に自動保存されます。
      </footer>

      {showLibrary && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowLibrary(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-semibold text-stone-800 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-emerald-700" />
                過去の議事録
              </h3>
              <button onClick={() => setShowLibrary(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 border-b border-stone-200">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="タイトル・メモ・文字起こしを検索"
                  className="w-full border border-stone-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredSessions.length === 0 ? (
                <p className="text-center text-sm text-stone-400 py-8">
                  {sessions.length === 0 ? "保存された議事録はまだありません。" : "該当する議事録が見つかりません。"}
                </p>
              ) : (
                filteredSessions.map((s) => {
                  const noteMatch = searchQuery ? highlightMatch(s.notes || "", searchQuery) : null;
                  const transcriptMatch = !noteMatch && searchQuery ? highlightMatch(s.transcript || "", searchQuery) : null;
                  return (
                    <button
                      key={s.id}
                      onClick={() => openSession(s)}
                      className={`w-full text-left p-3 border-b border-stone-100 hover:bg-stone-50 transition-colors flex items-start justify-between gap-2 ${
                        s.id === sessionId ? "bg-emerald-50" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-stone-800 truncate">{s.title || "無題の議事録"}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {new Date(s.updatedAt).toLocaleString("ja-JP")}　/　録音 {formatTime(s.elapsed || 0)}
                        </p>
                        {(noteMatch || transcriptMatch) && (
                          <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                            {noteMatch || transcriptMatch}
                          </p>
                        )}
                      </div>
                      <span onClick={(e) => deleteSessionFromLibrary(s.id, e)} className="text-stone-300 hover:text-red-500 shrink-0 p-1" title="削除">
                        <Trash2 className="w-4 h-4" />
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
