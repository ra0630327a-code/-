import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Link as LinkIcon, Paperclip, X,
  RotateCcw, Archive, GripVertical, Pencil,
  ListChecks, BookMarked
} from 'lucide-react';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const formatDue = (due) => {
  if (!due) return null;
  const d = new Date(due);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
};

const DEFAULT_TABS = [
  { id: 'tab-tasks', name: 'タスク', type: 'tasks' },
  { id: 'tab-links', name: 'リンク集', type: 'links' },
];
const DEFAULT_DATA = {
  'tab-tasks': [
    { id: 'a1', name: 'サーティワン', due: '', done: false, links: [], files: [] },
    { id: 'a2', name: '拒薬患者の対応', due: '2026-06-27', done: false, links: [], files: [] },
  ],
  'tab-links': [],
};

// Touch-friendly sort hook
function useTouchSort(items, onReorder) {
  const s = useRef({ active: false, fromIdx: null, startY: 0, curIdx: null });

  const onTouchStart = (e, i) => {
    s.current = { active: false, fromIdx: i, curIdx: i, startY: e.touches[0].clientY };
  };

  const onTouchMove = (e, containerSelector) => {
    const r = s.current;
    if (r.fromIdx === null) return;
    const dy = Math.abs(e.touches[0].clientY - r.startY);
    if (!r.active && dy < 6) return;
    r.active = true;
    e.preventDefault();
    const touch = e.touches[0];
    const rows = document.querySelectorAll(containerSelector);
    let hoverIdx = r.curIdx;
    rows.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) hoverIdx = idx;
    });
    if (hoverIdx !== r.curIdx) {
      const next = [...items];
      const [moved] = next.splice(r.curIdx, 1);
      next.splice(hoverIdx, 0, moved);
      r.curIdx = hoverIdx;
      onReorder(next);
    }
  };

  const onTouchEnd = () => { s.current = { active: false, fromIdx: null, startY: 0, curIdx: null }; };
  const isDragging = (i) => s.current.active && s.current.curIdx === i;

  return { onTouchStart, onTouchMove, onTouchEnd, isDragging };
}

export default function App() {
  const [tabs, setTabs] = useState(DEFAULT_TABS);
  const [data, setData] = useState(DEFAULT_DATA);
  const [trash, setTrash] = useState([]);
  const [activeTab, setActiveTab] = useState('tab-tasks');
  const [loaded, setLoaded] = useState(false);
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingTabName, setEditingTabName] = useState('');
  const [showAddTab, setShowAddTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabType, setNewTabType] = useState('tasks');
  const [showTrash, setShowTrash] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [newDue, setNewDue] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [linkInputs, setLinkInputs] = useState({});
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('memo-v2');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.tabs) setTabs(s.tabs);
        if (s.data) setData(s.data);
        if (s.trash) setTrash(s.trash);
        if (s.activeTab) setActiveTab(s.activeTab);
      }
    } catch(e) {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem('memo-v2', JSON.stringify({ tabs, data, trash, activeTab })); }
    catch(e) {}
  }, [tabs, data, trash, activeTab, loaded]);

  // Tab sort
  const tabSort = useTouchSort(tabs, setTabs);

  const addTab = () => {
    if (!newTabName.trim()) return;
    const id = 'tab-' + uid();
    setTabs([...tabs, { id, name: newTabName.trim(), type: newTabType }]);
    setData({ ...data, [id]: [] });
    setActiveTab(id);
    setNewTabName('');
    setShowAddTab(false);
  };

  const deleteTab = (id) => {
    if (tabs.length <= 1) return;
    const next = tabs.filter(t => t.id !== id);
    setTabs(next);
    const { [id]: _, ...rest } = data;
    setData(rest);
    if (activeTab === id) setActiveTab(next[0]?.id);
  };

  const saveTabName = (id) => {
    if (!editingTabName.trim()) return;
    setTabs(tabs.map(t => t.id === id ? { ...t, name: editingTabName.trim() } : t));
    setEditingTabId(null);
  };

  const setItems = (tabId, items) => setData({ ...data, [tabId]: items });
  const items = data[activeTab] || [];

  // Task ops
  const addTask = () => {
    if (!newTask.trim()) return;
    setItems(activeTab, [...items, { id: uid(), name: newTask.trim(), due: newDue, done: false, links: [], files: [] }]);
    setNewTask(''); setNewDue('');
  };
  const toggleDone = (id) => setItems(activeTab, items.map(t => t.id===id ? {...t,done:!t.done} : t));
  const removeTask = (id) => {
    const task = items.find(t => t.id===id);
    if (!task) return;
    setItems(activeTab, items.filter(t => t.id!==id));
    setTrash([{ ...task, _tab: activeTab, deletedAt: Date.now() }, ...trash]);
    if (expandedId===id) setExpandedId(null);
  };
  const restoreTask = (item) => {
    const { _tab, deletedAt, ...rest } = item;
    setTrash(trash.filter(t => t.id!==item.id));
    const target = data[_tab] !== undefined ? _tab : tabs[0]?.id;
    if (!target) return;
    setData({ ...data, [target]: [...(data[target]||[]), rest] });
  };
  const addTaskLink = (taskId) => {
    const url = (linkInputs[taskId]||'').trim();
    if (!url) return;
    setItems(activeTab, items.map(t => t.id===taskId ? {...t,links:[...(t.links||[]),url]} : t));
    setLinkInputs({ ...linkInputs, [taskId]: '' });
  };
  const removeTaskLink = (taskId, idx) =>
    setItems(activeTab, items.map(t => t.id===taskId ? {...t,links:t.links.filter((_,i)=>i!==idx)} : t));
  const addTaskFile = (taskId, fileList) => {
    const names = Array.from(fileList).map(f=>f.name);
    setItems(activeTab, items.map(t => t.id===taskId ? {...t,files:[...(t.files||[]),...names]} : t));
  };
  const removeTaskFile = (taskId, idx) =>
    setItems(activeTab, items.map(t => t.id===taskId ? {...t,files:t.files.filter((_,i)=>i!==idx)} : t));

  // Task sort
  const taskSort = useTouchSort(items, i => setItems(activeTab, i));

  // Link ops
  const addLink = () => {
    if (!newUrl.trim()) return;
    setItems(activeTab, [{ id: uid(), url: newUrl.trim(), label: newLabel.trim() }, ...items]);
    setNewUrl(''); setNewLabel('');
  };
  const removeLink = (id) => setItems(activeTab, items.filter(l => l.id!==id));
  const linkSort = useTouchSort(items, i => setItems(activeTab, i));

  const currentTab = tabs.find(t => t.id===activeTab);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex justify-center select-none">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-neutral-800 flex items-end justify-between">
          <div>
            <div className="text-xs text-neutral-500 mb-1">プライベート</div>
            <h1 className="text-2xl font-bold tracking-tight">memo</h1>
          </div>
          {currentTab?.type === 'tasks' && (
            <button onClick={() => setShowTrash(!showTrash)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded mb-1 transition-colors ${showTrash ? 'text-neutral-100' : 'text-neutral-500'}`}>
              <Archive size={14}/>
              {trash.length > 0 && <span>{trash.length}</span>}
            </button>
          )}
        </div>

        {/* Trash panel */}
        {showTrash && currentTab?.type === 'tasks' && (
          <div className="border-b border-neutral-800">
            <div className="px-5 py-2 text-xs text-neutral-500">ゴミ箱 ({trash.length})</div>
            {trash.length === 0
              ? <div className="px-5 py-6 text-center text-xs text-neutral-600">削除したタスクはありません</div>
              : trash.map(item => (
                <div key={item.id} className="flex items-center px-5 py-3 border-t border-neutral-800/60">
                  <span className="flex-1 text-sm text-neutral-400 truncate">{item.name}</span>
                  <button onClick={() => restoreTask(item)} className="flex items-center gap-1 text-xs text-blue-400 px-2">
                    <RotateCcw size={12}/> 復元
                  </button>
                  <button onClick={() => setTrash(trash.filter(t=>t.id!==item.id))} className="text-neutral-500 px-2">
                    <X size={14}/>
                  </button>
                </div>
              ))
            }
          </div>
        )}

        {/* Tab bar */}
        <div className="flex items-center border-b border-neutral-800 overflow-x-auto">
          {tabs.map((tab, i) => (
            <div key={tab.id}
              data-tab-sortable
              onTouchStart={e => tabSort.onTouchStart(e, i)}
              onTouchMove={e => tabSort.onTouchMove(e, '[data-tab-sortable]')}
              onTouchEnd={tabSort.onTouchEnd}
              onClick={() => { setActiveTab(tab.id); setShowTrash(false); }}
              className={`group relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap cursor-pointer border-b-2 transition-colors shrink-0 ${
                activeTab===tab.id ? 'border-blue-500 text-neutral-100' : 'border-transparent text-neutral-500'
              } ${tabSort.isDragging(i) ? 'opacity-40' : ''}`}>
              {tab.type==='tasks' ? <ListChecks size={14}/> : <BookMarked size={14}/>}
              {editingTabId===tab.id ? (
                <input autoFocus value={editingTabName}
                  onChange={e => setEditingTabName(e.target.value)}
                  onKeyDown={e => { if(e.key==='Enter') saveTabName(tab.id); if(e.key==='Escape') setEditingTabId(null); }}
                  onClick={e => e.stopPropagation()}
                  className="bg-neutral-800 text-neutral-100 text-sm rounded px-1 w-20 focus:outline-none"/>
              ) : <span>{tab.name}</span>}
              <span className="hidden group-hover:flex items-center gap-0.5" onClick={e=>e.stopPropagation()}>
                <button className="text-neutral-600 p-0.5"
                  onClick={() => { setEditingTabId(tab.id); setEditingTabName(tab.name); }}>
                  <Pencil size={10}/>
                </button>
                {tabs.length > 1 && (
                  <button className="text-neutral-600 p-0.5" onClick={() => deleteTab(tab.id)}>
                    <X size={10}/>
                  </button>
                )}
              </span>
            </div>
          ))}
          <button onClick={() => setShowAddTab(!showAddTab)} className="px-3 py-3 text-neutral-500 shrink-0">
            <Plus size={16}/>
          </button>
        </div>

        {/* Add tab form */}
        {showAddTab && (
          <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
            <input autoFocus value={newTabName} onChange={e=>setNewTabName(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&addTab()} placeholder="タブ名"
              className="flex-1 bg-neutral-900 text-sm text-neutral-100 placeholder-neutral-600 rounded px-2 py-1.5 border border-neutral-800 focus:outline-none focus:border-neutral-600"/>
            <select value={newTabType} onChange={e=>setNewTabType(e.target.value)}
              className="bg-neutral-900 text-xs text-neutral-300 rounded px-2 py-1.5 border border-neutral-800 focus:outline-none">
              <option value="tasks">タスク</option>
              <option value="links">リンク集</option>
            </select>
            <button onClick={addTab} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded">追加</button>
            <button onClick={()=>setShowAddTab(false)} className="text-neutral-500"><X size={16}/></button>
          </div>
        )}

        {/* TASKS */}
        {currentTab?.type === 'tasks' && (
          <>
            <div className="flex items-center px-5 py-2 text-xs text-neutral-500 border-b border-neutral-800/60">
              <span className="flex-1">タスク名</span>
              <span>期日</span>
            </div>
            <div>
              {items.map((task, i) => {
                const isOpen = expandedId===task.id;
                const attachCount = (task.links?.length||0)+(task.files?.length||0);
                return (
                  <div key={task.id} data-task-sortable
                    className={`border-b border-neutral-800/60 transition-opacity ${taskSort.isDragging(i)?'opacity-40':''}`}>
                    <div className="flex items-center px-3 py-4 hover:bg-neutral-900/60 transition-colors">
                      <div
                        className="touch-none mr-2 shrink-0 cursor-grab active:cursor-grabbing p-1 -ml-1"
                        onTouchStart={e => taskSort.onTouchStart(e, i)}
                        onTouchMove={e => taskSort.onTouchMove(e, '[data-task-sortable]')}
                        onTouchEnd={taskSort.onTouchEnd}
                      >
                        <GripVertical size={14} className="text-neutral-600"/>
                      </div>
                      <button onClick={()=>toggleDone(task.id)}
                        className={`flex-1 text-left text-[15px] truncate ${task.done?'line-through text-neutral-500':'text-neutral-100'}`}>
                        {task.name}
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.due ? <span className="text-sky-400 text-xs whitespace-nowrap">{formatDue(task.due)}</span>
                          : <span className="text-neutral-600 text-xs">-</span>}
                        <button onClick={()=>setExpandedId(isOpen?null:task.id)}
                          className={`text-xs px-2 py-1 rounded border ${attachCount>0?'border-neutral-700 text-neutral-300':'border-neutral-800 text-neutral-500'}`}>
                          {attachCount>0?`開く(${attachCount})`:'開く'}
                        </button>
                        <button onClick={()=>removeTask(task.id)} className="text-neutral-500 active:text-red-400">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="px-4 pb-4 pl-10 space-y-3 bg-neutral-900/40">
                        {task.links?.map((url,idx)=>(
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <LinkIcon size={12} className="text-sky-400 shrink-0"/>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline truncate flex-1">{url}</a>
                            <button onClick={()=>removeTaskLink(task.id,idx)} className="text-neutral-500"><X size={12}/></button>
                          </div>
                        ))}
                        {task.files?.map((name,idx)=>(
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <Paperclip size={12} className="text-neutral-400 shrink-0"/>
                            <span className="text-neutral-300 truncate flex-1">{name}</span>
                            <button onClick={()=>removeTaskFile(task.id,idx)} className="text-neutral-500"><X size={12}/></button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <LinkIcon size={12} className="text-neutral-500 shrink-0"/>
                          <input value={linkInputs[task.id]||''} onChange={e=>setLinkInputs({...linkInputs,[task.id]:e.target.value})}
                            onKeyDown={e=>e.key==='Enter'&&addTaskLink(task.id)} placeholder="URLを貼り付け"
                            className="flex-1 bg-neutral-900 text-xs text-neutral-100 placeholder-neutral-600 rounded px-2 py-1.5 border border-neutral-800 focus:outline-none focus:border-neutral-600"/>
                          <button onClick={()=>addTaskLink(task.id)} className="text-xs text-blue-400 px-2">追加</button>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
                          <Paperclip size={12}/><span>ファイルを添付</span>
                          <input type="file" multiple className="hidden" onChange={e=>e.target.files.length&&addTaskFile(task.id,e.target.files)}/>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-4 space-y-2">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-neutral-500"/>
                <input value={newTask} onChange={e=>setNewTask(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&addTask()} placeholder="新規タスク"
                  className="flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none"/>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <input type="date" value={newDue} onChange={e=>setNewDue(e.target.value)}
                  className="bg-neutral-900 text-xs text-neutral-300 rounded px-2 py-1 border border-neutral-800 focus:outline-none focus:border-neutral-600"/>
                <button onClick={addTask} className="ml-auto bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded">追加</button>
              </div>
            </div>
          </>
        )}

        {/* LINKS */}
        {currentTab?.type === 'links' && (
          <>
            <div className="px-5 py-4 space-y-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <LinkIcon size={14} className="text-neutral-500 shrink-0"/>
                <input value={newUrl} onChange={e=>setNewUrl(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&addLink()} placeholder="URLを貼り付け"
                  className="flex-1 bg-neutral-900 text-sm text-neutral-100 placeholder-neutral-600 rounded px-2 py-1.5 border border-neutral-800 focus:outline-none focus:border-neutral-600"/>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <input value={newLabel} onChange={e=>setNewLabel(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&addLink()} placeholder="タイトル(省略可)"
                  className="flex-1 bg-neutral-900 text-xs text-neutral-300 placeholder-neutral-600 rounded px-2 py-1 border border-neutral-800 focus:outline-none focus:border-neutral-600"/>
                <button onClick={addLink} className="bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded">追加</button>
              </div>
            </div>
            {items.length===0
              ? <div className="px-5 py-10 text-center text-xs text-neutral-600">まだリンクが追加されていません</div>
              : items.map((link,i)=>(
                <div key={link.id} data-link-sortable
                  className={`flex items-center px-3 py-4 border-b border-neutral-800/60 transition-opacity ${linkSort.isDragging(i)?'opacity-40':''}`}>
                  <div className="touch-none mr-2 shrink-0 cursor-grab p-1 -ml-1"
                    onTouchStart={e=>linkSort.onTouchStart(e,i)}
                    onTouchMove={e=>linkSort.onTouchMove(e,'[data-link-sortable]')}
                    onTouchEnd={linkSort.onTouchEnd}>
                    <GripVertical size={14} className="text-neutral-600"/>
                  </div>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                    {link.label&&<div className="text-[15px] text-neutral-100 truncate">{link.label}</div>}
                    <div className="text-xs text-sky-400 underline truncate">{link.url}</div>
                  </a>
                  <button onClick={()=>removeLink(link.id)} className="text-neutral-500 active:text-red-400 ml-3 shrink-0">
                    <Trash2 size={14}/>
                  </button>
                </div>
              ))
            }
          </>
        )}

      </div>
    </div>
  );
}
