'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Check, Clock, Focus, Gift, Pause, Play, Plus, RefreshCw, Rocket, Star, Timer, X } from "lucide-react";

type Task = { id: string; title: string; notes?: string; impact: number; urgency: number; energyFit: number; complexity: number; effort: number; tags: string[]; done: boolean; createdAt: number };

type SessionLog = { id: string; taskId?: string; start: number; end?: number; cycles: number };

type Shape = 'I'|'O'|'T'|'S'|'Z'|'J'|'L';

type Inventory = Record<Shape, number>;

const SHAPES: Shape[] = ['I','O','T','S','Z','J','L'];
const SHAPE_COLOR: Record<Shape,string> = { I: "#17E9E0", O: "#FCCD04", T: "#A64AC9", S: "#8DE36F", Z: "#FF6B6B", J: "#4DA3FF", L: "#FFB48F" };

const uid = () => Math.random().toString(36).slice(2, 10);

function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : defaultValue } catch { return defaultValue }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)) } catch {} }, [key, value]);
  return [value, setValue] as const;
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)) }

const defaultWeights = { impact: 0.4, urgency: 0.3, energyFit: 0.2, complexity: 0.1 };

function taskScore(t: Task, w = defaultWeights) {
  const imp = clamp01(t.impact / 5), urg = clamp01(t.urgency / 5), fit = clamp01(t.energyFit / 5), cpx = clamp01(t.complexity / 5);
  const effortPenalty = clamp01((t.effort - 1) / 7) * 0.1;
  return Math.max(0, w.impact * imp + w.urgency * urg + w.energyFit * fit - w.complexity * cpx - effortPenalty);
}

export default function SparkPlugApp() {
  const [tasks, setTasks] = useLocalStorage<Task[]>("sp.tasks", []);
  const [weights, setWeights] = useLocalStorage("sp.weights", defaultWeights);
  const [rewards, setRewards] = useLocalStorage("sp.rewards", { coins: 0, streak: 0, lastDay: "" });
  const [logs, setLogs] = useLocalStorage<SessionLog[]>("sp.logs", []);
  const [inventory, setInventory] = useLocalStorage<Inventory>("sp.tetris.inv", { I:0,O:0,T:0,S:0,Z:0,J:0,L:0 });
  const [lastAward, setLastAward] = useState<Shape[]>([]);

  const [focusLen, setFocusLen] = useLocalStorage<number>("sp.focusLen", 25);
  const [breakLen, setBreakLen] = useLocalStorage<number>("sp.breakLen", 5);
  const [longBreakLen, setLongBreakLen] = useLocalStorage<number>("sp.longBreakLen", 15);
  const [cyclesForLongBreak, setCyclesForLongBreak] = useLocalStorage<number>("sp.cyclesForLongBreak", 4);

  const [isRunning, setIsRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [phase, setPhase] = useState<"focus" | "break" | "longBreak">("focus");
  const [cycles, setCycles] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>(undefined);
  const timerRef = useRef<number | null>(null);

  useEffect(() => { if (secondsLeft === 0) setSecondsLeft(focusLen * 60) }, []);

  useEffect(() => {
    if (!isRunning) return; 
    timerRef.current = window.setInterval(() => { setSecondsLeft((s) => { if (s <= 1) { handlePhaseEnd(); return 0 } return s - 1 }) }, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); timerRef.current = null };
  }, [isRunning]);

  function handlePhaseEnd() {
    if (phase === "focus") {
      awardFocusCompletion();
      const nextCycles = cycles + 1; setCycles(nextCycles);
      if (nextCycles % cyclesForLongBreak === 0) { setPhase("longBreak"); setSecondsLeft(longBreakLen * 60) } else { setPhase("break"); setSecondsLeft(breakLen * 60) }
    } else { setPhase("focus"); setSecondsLeft(focusLen * 60) }
  }

  function awardFocusCompletion() {
    const today = new Date().toISOString().slice(0, 10);
    setRewards((r) => { const newStreak = r.lastDay === today ? r.streak : (r.lastDay && r.lastDay < today ? r.streak + 1 : 1); return { coins: r.coins + 10, streak: newStreak, lastDay: today } });
    setLogs((L) => [ ...L, { id: uid(), taskId: currentTaskId, start: Date.now() - focusLen * 60 * 1000, end: Date.now(), cycles: 1 } ]);
  }

  const ranked = useMemo(() => tasks.filter((t) => !t.done).map((t) => ({ t, score: taskScore(t, weights) })).sort((a, b) => b.score - a.score), [tasks, weights]);
  const totalEffort = useMemo(() => tasks.filter((t) => !t.done).reduce((s, t) => s + (t.effort || 1), 0), [tasks]);

  function addTaskFromQuick(title: string) { const newTask: Task = { id: uid(), title: title.trim(), impact: 3, urgency: 3, energyFit: 3, complexity: 2, effort: 1, tags: [], done: false, createdAt: Date.now() }; setTasks((T) => [newTask, ...T]) }

  function awardRandomTetrisPieces(nMin=1, nMax=3) { const n = Math.floor(Math.random() * (nMax - nMin + 1)) + nMin; const gained: Shape[] = []; const next = { ...inventory }; for (let i=0;i<n;i++) { const s = SHAPES[Math.floor(Math.random()*SHAPES.length)]; next[s] = (next[s]||0)+1; gained.push(s) } setInventory(next); setLastAward(gained) }

  function removeTask(id: string) { setTasks((T) => T.filter((x) => x.id !== id)) }

  function toggleDone(id: string) { setTasks((T) => T.map((x) => { if (x.id !== id) return x; const toDone = !x.done; if (toDone) awardRandomTetrisPieces(); return { ...x, done: toDone } })) }

  function updateTask(id: string, patch: Partial<Task>) { setTasks((T) => T.map((x) => (x.id === id ? { ...x, ...patch } : x))) }

  function formatClock(s: number) { const m = Math.floor(s / 60); const ss = s % 60; return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` }

  function bestNextTaskId() { return ranked[0]?.t.id }

  useEffect(()=>{ runTetrisTests() },[]);

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto grid gap-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rocket className="w-6 h-6" />
            <h1 className="text-2xl font-semibold">火花塞 Spark Plug — MVP</h1>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm">Coins: {rewards.coins}</Badge>
            <Badge variant="outline" className="text-sm">Streak: {rewards.streak}</Badge>
          </div>
        </header>

        <Tabs defaultValue="priority" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="priority" className="flex gap-2"><Star className="w-4 h-4"/>Priority</TabsTrigger>
            <TabsTrigger value="focus" className="flex gap-2"><Focus className="w-4 h-4"/>Focus</TabsTrigger>
            <TabsTrigger value="reward" className="flex gap-2"><Gift className="w-4 h-4"/>Reward</TabsTrigger>
          </TabsList>

          <TabsContent value="priority">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="col-span-2">
                <CardContent className="p-4">
                  <QuickAdd onAdd={addTaskFromQuick} />
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-neutral-400">未完成任务：{ranked.length} · 预计总番茄：{totalEffort}</div>
                    <div className="text-sm text-neutral-400">权重：Impact {weights.impact} ｜ Urgency {weights.urgency} ｜ Fit {weights.energyFit} ｜ Complexity {weights.complexity}</div>
                  </div>
                  <div className="mt-3 grid gap-3">
                    {ranked.map(({ t, score }) => (
                      <TaskRow key={t.id} t={t} score={score} onUpdate={updateTask} onRemove={removeTask} onToggleDone={toggleDone} onPick={() => setCurrentTaskId(t.id)} />
                    ))}
                    {ranked.length === 0 && <div className="text-neutral-400 text-sm">暂无任务，添加一个吧。</div>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-6">
                  <div className="font-medium">权重调整</div>
                  <WeightSlider label="Impact" value={weights.impact} onChange={(v)=>setWeights({...weights, impact:v})} />
                  <WeightSlider label="Urgency" value={weights.urgency} onChange={(v)=>setWeights({...weights, urgency:v})} />
                  <WeightSlider label="EnergyFit" value={weights.energyFit} onChange={(v)=>setWeights({...weights, energyFit:v})} />
                  <WeightSlider label="- Complexity" value={weights.complexity} onChange={(v)=>setWeights({...weights, complexity:v})} />
                  <div className="text-xs text-neutral-400">建议：Impact &gt; Urgency &gt; Fit &gt; Complexity。Effort 会轻微扣分，鼓励拆分。</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="focus">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="col-span-2">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xl font-semibold">
                      <Timer className="w-5 h-5" />{formatClock(secondsLeft)}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isRunning ? (
                        <Button onClick={()=> setIsRunning(true)} size="sm" className="rounded-2xl"><Play className="w-4 h-4 mr-1"/>开始</Button>
                      ) : (
                        <Button onClick={()=> setIsRunning(false)} size="sm" variant="secondary" className="rounded-2xl"><Pause className="w-4 h-4 mr-1"/>暂停</Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={()=>{ setIsRunning(false); setPhase("focus"); setSecondsLeft(focusLen*60); setCycles(0) }}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-neutral-400 flex items-center gap-2">
                    <Clock className="w-4 h-4"/> 当前阶段：{phase === "focus" ? "专注" : phase === "break" ? "短休息" : "长休息"} · 已完成番茄：{cycles}
                  </div>
                  <Progress value={(secondsLeft / ((phase === "focus" ? focusLen : phase === "break" ? breakLen : longBreakLen) * 60)) * 100} className="mt-4"/>
                  <div className="mt-6">
                    <div className="font-medium mb-2">当前任务</div>
                    <TaskSelector tasks={tasks} currentTaskId={currentTaskId} onPick={setCurrentTaskId} bestId={bestNextTaskId()} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="font-medium">番茄钟设置</div>
                  <NumberSlider label="专注(分钟)" value={focusLen} min={15} max={60} step={5} onChange={setFocusLen} />
                  <NumberSlider label="短休息(分钟)" value={breakLen} min={3} max={15} step={1} onChange={setBreakLen} />
                  <NumberSlider label="长休息(分钟)" value={longBreakLen} min={10} max={30} step={5} onChange={setLongBreakLen} />
                  <NumberSlider label="长休息间隔(番茄)" value={cyclesForLongBreak} min={3} max={6} step={1} onChange={setCyclesForLongBreak} />
                  <div className="text-xs text-neutral-400">提示：每完成一个专注阶段会+10 Coins；连续多天有 streak。</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reward">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="col-span-2">
                <CardContent className="p-6">
                  <div className="font-medium mb-4">奖励：俄罗斯方块</div>
                  {lastAward.length>0 && (
                    <div className="mb-3 text-sm">获得方块：{lastAward.map((s,i)=>(<Badge key={i} className="mr-1">{s}</Badge>))}</div>
                  )}
                  <TetrisInventory inventory={inventory} />
                  <div className="mt-4"><TetrisPlay inventory={inventory} setInventory={setInventory} /></div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="font-medium">今日小目标建议</div>
                  <ul className="text-sm list-disc ml-5 space-y-1 text-neutral-300">
                    <li>把得分最高的任务拆成 ≤ 2 个番茄的小块。</li>
                    <li>第一块只做“准备工”：收集资料/开文件/搭骨架。</li>
                    <li>完成任务时会获得随机方块，马上去玩一局！</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <footer className="text-xs text-neutral-500 text-center mt-6">v0.21 — 修复渲染错误与画面颜色；本地保存。</footer>
      </div>
    </div>
  );
}

function QuickAdd({ onAdd }: { onAdd: (t: string) => void }) { const [val, setVal] = useState(""); return (<div className="flex gap-2"><Input placeholder="快速添加任务（回车确认）" value={val} onChange={(e)=>setVal(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter' && val.trim()){ onAdd(val); setVal("") } }} /><Button onClick={()=>{ if(val.trim()){ onAdd(val); setVal("") } }} className="rounded-2xl"><Plus className="w-4 h-4 mr-1"/>添加</Button></div>) }

function WeightSlider({ label, value, onChange }:{ label: string; value: number; onChange: (v:number)=>void }){ return (<div><div className="flex items-center justify-between mb-2"><span className="text-sm">{label}</span><span className="text-xs text-neutral-400">{value.toFixed(2)}</span></div><Slider value={[value]} min={0} max={1} step={0.05} onValueChange={(v)=>onChange(v[0])} /></div>) }

function NumberSlider({ label, value, min, max, step, onChange }:{ label:string; value:number; min:number; max:number; step:number; onChange:(v:number)=>void }){ return (<div><div className="flex items-center justify-between mb-2"><span className="text-sm">{label}</span><span className="text-xs text-neutral-400">{value}</span></div><Slider value={[value]} min={min} max={max} step={step} onValueChange={(v)=>onChange(v[0])} /></div>) }

function TaskRow({ t, score, onUpdate, onRemove, onToggleDone, onPick }:{ t:Task; score:number; onUpdate:(id:string,p:Partial<Task>)=>void; onRemove:(id:string)=>void; onToggleDone:(id:string)=>void; onPick:()=>void }){
  return (
    <div className="rounded-2xl border border-neutral-800 p-3 flex gap-3 items-start">
      <div className="w-1/12 min-w-[70px]"><div className="text-xs text-neutral-400 mb-1">Score</div><div className="text-lg font-semibold">{(score*100).toFixed(0)}</div></div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="font-medium truncate mr-2">{t.title}</div>
          <div className="flex gap-2">
            <Button size="icon" variant="secondary" onClick={onPick} title="选为当前任务" className="rounded-2xl"><Focus className="w-4 h-4"/></Button>
            <Button size="icon" variant="ghost" onClick={()=>onToggleDone(t.id)} title="完成/未完成" className="rounded-2xl">{t.done ? <X className="w-4 h-4"/> : <Check className="w-4 h-4"/>}</Button>
            <Button size="icon" variant="ghost" onClick={()=>onRemove(t.id)} title="删除" className="rounded-2xl"><X className="w-4 h-4"/></Button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3 mt-3">
          <Dial label="Impact" value={t.impact} onChange={(v)=>onUpdate(t.id,{ impact:v })} />
          <Dial label="Urgency" value={t.urgency} onChange={(v)=>onUpdate(t.id,{ urgency:v })} />
          <Dial label="Fit" value={t.energyFit} onChange={(v)=>onUpdate(t.id,{ energyFit:v })} />
          <Dial label="Complexity" value={t.complexity} onChange={(v)=>onUpdate(t.id,{ complexity:v })} />
          <Dial label="番茄数" value={t.effort} min={1} max={8} onChange={(v)=>onUpdate(t.id,{ effort:v })} />
        </div>
        {t.tags.length>0 && (<div className="mt-2 flex flex-wrap gap-1">{t.tags.map((tag)=>(<Badge key={tag} variant="secondary">{tag}</Badge>))}</div>)}
      </div>
    </div>
  )
}

function Dial({ label, value, min=0, max=5, onChange }:{ label:string; value:number; min?:number; max?:number; onChange:(v:number)=>void }){ return (<div><div className="text-xs text-neutral-400 mb-1">{label}</div><div className="flex items-center gap-2"><Button size="icon" variant="ghost" onClick={()=>onChange(Math.max(min, value-1))} className="rounded-2xl">-</Button><div className="w-10 text-center">{value}</div><Button size="icon" variant="ghost" onClick={()=>onChange(Math.min(max, value+1))} className="rounded-2xl">+</Button></div></div>) }

function TaskSelector({ tasks, currentTaskId, onPick, bestId }:{ tasks:Task[]; currentTaskId?:string; onPick:(id:string)=>void; bestId?:string }){ const candidates = useMemo(()=> tasks.filter(t=>!t.done), [tasks]); return (<div className="grid gap-2">{candidates.length===0 && <div className="text-neutral-400 text-sm">暂无候选任务。</div>}{candidates.map(t=> (<div key={t.id} className={`p-3 rounded-2xl border ${currentTaskId===t.id? 'border-emerald-500' : 'border-neutral-800'} flex items-center justify-between`}><div className="flex items-center gap-2">{bestId===t.id && <Badge>推荐</Badge>}<div className="font-medium">{t.title}</div><div className="text-xs text-neutral-400">· {t.effort} 🍅</div></div><Button size="sm" onClick={()=>onPick(t.id)} className="rounded-2xl">选择</Button></div>))}</div>) }

function RedeemCenter({ coins, onRedeem }:{ coins:number; onRedeem:(cost:number)=>void }){ const items = [ { id: "r1", name: "咖啡时间", cost: 20, desc: "奖励自己一杯咖啡" }, { id: "r2", name: "散步 10 分钟", cost: 15, desc: "舒展放松" }, { id: "r3", name: "看剧 20 分钟", cost: 30, desc: "轻松一下" } ]; return (<div className="grid sm:grid-cols-3 gap-3">{items.map(it=> (<div key={it.id} className="rounded-2xl border border-neutral-800 p-4"><div className="font-medium flex items-center justify-between">{it.name}<Badge variant="outline">{it.cost}c</Badge></div><div className="text-xs text-neutral-400 mt-1">{it.desc}</div><Button disabled={coins<it.cost} onClick={()=>onRedeem(it.cost)} className="mt-3 w-full rounded-2xl">兑换</Button></div>))}</div>) }

function TetrisInventory({ inventory }:{ inventory: Inventory }){ return (<div className="rounded-2xl border border-neutral-800 p-3"><div className="text-sm mb-2">库存</div><div className="grid grid-cols-7 gap-2">{SHAPES.map(s=> (<div key={s} className="rounded-xl border border-neutral-800 p-2 text-center"><div className="text-xs">{s}</div><div className="text-lg font-semibold">{inventory[s]}</div></div>))}</div></div>) }

type GameState = { board: number[][]; piece: { shape: Shape; x: number; y: number; r: number } | null; over: boolean; score: number };

const PIECE_MAP: Record<Shape, number[][][]> = {
  I: [ [[1,1,1,1]], [[1],[1],[1],[1]] ],
  O: [ [[1,1],[1,1]] ],
  T: [ [[1,1,1],[0,1,0]], [[1,0],[1,1],[1,0]], [[0,1,0],[1,1,1]], [[0,1],[1,1],[0,1]] ],
  S: [ [[0,1,1],[1,1,0]], [[1,0],[1,1],[0,1]] ],
  Z: [ [[1,1,0],[0,1,1]], [[0,1],[1,1],[1,0]] ],
  J: [ [[1,0,0],[1,1,1]], [[1,1],[1,0],[1,0]], [[1,1,1],[0,0,1]], [[0,1],[0,1],[1,1]] ],
  L: [ [[0,0,1],[1,1,1]], [[1,0],[1,0],[1,1]], [[1,1,1],[1,0,0]], [[1,1],[0,1],[0,1]] ],
};

function createBoard(h=20,w=10){ return Array.from({length:h},()=>Array(w).fill(0)) }

function canPlace(board:number[][], shape:number[][], x:number, y:number){ for (let r=0;r<shape.length;r++){ for(let c=0;c<shape[0].length;c++){ if (shape[r][c]){ const nx=x+c, ny=y+r; if (ny<0||ny>=board.length||nx<0||nx>=board[0].length||board[ny][nx]) return false } } } return true }

function merge(board:number[][], shape:number[][], x:number, y:number){ const b = board.map(row=>row.slice()); for (let r=0;r<shape.length;r++){ for(let c=0;c<shape[0].length;c++){ if (shape[r][c]) b[y+r][x+c]=1 } } return b }

function clearLines(board:number[][]){ const kept = board.filter(row=>row.some(v=>v===0)); const cleared = board.length - kept.length; while(kept.length<board.length) kept.unshift(Array(board[0].length).fill(0)); return { board: kept, lines: cleared } }

function generateGarbage(h:number,w:number,rows:number){ const b = createBoard(h,w); for(let i=0;i<rows;i++){ const y = h-1-i; const gap = Math.floor(Math.random()*w); for(let x=0;x<w;x++) b[y][x] = x===gap ? 0 : (Math.random()<0.9?1:0); if (b[y].every(v=>v===1)) b[y][Math.floor(Math.random()*w)] = 0 } return b }

function spawnFromInventory(inv: Inventory, setInv:(inv:Inventory)=>void): { piece: { shape: Shape; x:number; y:number; r:number } | null, consumed?: Shape }{ const available: Shape[] = SHAPES.filter(s=> (inv[s]||0)>0); if (available.length===0) return { piece: null }; const idx = Math.floor(Math.random()*available.length); const shape = available[idx]; const next = { ...inv, [shape]: Math.max(0, (inv[shape]||0)-1) }; setInv(next); const matrix = PIECE_MAP[shape][0]; const x = Math.floor((10 - matrix[0].length)/2); return { piece: { shape, x, y: 0, r: 0 }, consumed: shape } }

function draw(ctx: CanvasRenderingContext2D, state: GameState){
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const cols = state.board[0].length, rows = state.board.length;
  const cw = Math.floor(w/cols), ch = Math.floor(h/rows);
  ctx.clearRect(0,0,w,h);
  const palette = ["#A64AC9", "#FCCD04", "#FFB48F", "#F5E6CC", "#17E9E0"];
  for (let r=0; r<rows; r++){
    for (let c=0; c<cols; c++){
      if (state.board[r][c]){
        const color = palette[(r*13 + c*7) % palette.length];
        ctx.fillStyle = color;
        ctx.fillRect(c*cw, r*ch, cw-1, ch-1);
      }
    }
  }
  if (state.piece){
    const shape = PIECE_MAP[state.piece.shape][state.piece.r];
    ctx.fillStyle = SHAPE_COLOR[state.piece.shape];
    for (let r=0; r<shape.length; r++){
      for (let c=0; c<shape[0].length; c++){
        if (shape[r][c]){
          ctx.fillRect((state.piece.x+c)*cw, (state.piece.y+r)*ch, cw-1, ch-1);
        }
      }
    }
  }
}

function TetrisPlay({ inventory, setInventory }:{ inventory: Inventory; setInventory: (inv:Inventory)=>void }){
  const [prefill, setPrefill] = useState(2);
  const [state, setState] = useState<GameState>({ board: generateGarbage(20,10,2), piece: null, over:false, score:0 });
  const [running, setRunning] = useState(false);
  const [lastConsumed, setLastConsumed] = useState<Shape|undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const rafRef = useRef<number|undefined>(undefined);
  const stateRef = useRef(state); useEffect(()=>{ stateRef.current = state },[state]);

  function ensurePiece(){ if (!stateRef.current.piece){ const { piece, consumed } = spawnFromInventory(inventory, setInventory); if (piece){ setState(s=>({ ...s, piece })); setLastConsumed(consumed) } else { setRunning(false) } } }

  function step(){ setState((s)=>{ if (s.over) return s; if (!s.piece) return s; const shape = PIECE_MAP[s.piece.shape][s.piece.r]; const ny = s.piece.y + 1; if (canPlace(s.board, shape, s.piece.x, ny)) return { ...s, piece: { ...s.piece, y: ny } }; const merged = merge(s.board, shape, s.piece.x, s.piece.y); const { board, lines } = clearLines(merged); return { ...s, board, piece: null, score: s.score + lines*100 } }) }

  useEffect(()=>{ ensurePiece() },[inventory, state.piece]);

  useEffect(()=>{ if (!running) return; let last = performance.now(); const loop = (t:number) => { if (t-last>600){ step(); last=t } const ctx = canvasRef.current?.getContext('2d'); if (ctx) draw(ctx, stateRef.current); rafRef.current = requestAnimationFrame(loop) }; rafRef.current = requestAnimationFrame(loop); return ()=>{ if (rafRef.current) cancelAnimationFrame(rafRef.current) } }, [running]);

  useEffect(()=>{ const ctx = canvasRef.current?.getContext('2d'); if (ctx) draw(ctx, state) },[state]);

  function move(dx:number){ setState(s=>{ if(!s.piece) return s; const shape = PIECE_MAP[s.piece.shape][s.piece.r]; const nx = s.piece.x + dx; if (canPlace(s.board, shape, nx, s.piece.y)) return { ...s, piece: { ...s.piece, x: nx } }; return s }) }
  function rotate(){ setState(s=>{ if(!s.piece) return s; const nr = (s.piece.r+1)%PIECE_MAP[s.piece.shape].length; const shape = PIECE_MAP[s.piece.shape][nr]; if (canPlace(s.board, shape, s.piece.x, s.piece.y)) return { ...s, piece: { ...s.piece, r: nr } }; return s }) }
  function hardDrop(){ setState(s=>{ if(!s.piece) return s; let y=s.piece.y; const shape = PIECE_MAP[s.piece.shape][s.piece.r]; while(canPlace(s.board, shape, s.piece.x, y+1)) y++; return { ...s, piece: { ...s.piece, y } } }); step() }
  function reset(){ setState({ board: generateGarbage(20,10,Math.max(0,Math.min(10,prefill))), piece:null, over:false, score:0 }); setRunning(false) }

  return (
    <div className="rounded-2xl border border-neutral-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm">得分：{state.score}</div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1 text-xs">
            <Button size="icon" variant="ghost" onClick={()=>setPrefill(Math.max(0,prefill-1))}>-</Button>
            <div>预置行:{prefill}</div>
            <Button size="icon" variant="ghost" onClick={()=>setPrefill(Math.min(10,prefill+1))}>+</Button>
          </div>
          {!running ? <Button size="sm" onClick={()=>setRunning(true)}>开始</Button> : <Button variant="secondary" size="sm" onClick={()=>setRunning(false)}>暂停</Button>}
          <Button variant="ghost" size="sm" onClick={reset}>重开</Button>
        </div>
      </div>
      <canvas ref={canvasRef} width={200} height={400} className="bg-neutral-900 rounded-xl mx-auto" />
      <div className="mt-2 text-xs text-neutral-400">{lastConsumed ? `使用方块：${lastConsumed}` : `没有库存时无法继续，下次完成任务可获得随机方块。`}</div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={()=>move(-1)}>左</Button>
        <Button size="sm" onClick={rotate}>旋转</Button>
        <Button size="sm" onClick={()=>move(1)}>右</Button>
        <Button size="sm" onClick={hardDrop}>硬降</Button>
      </div>
    </div>
  )
}

function runTetrisTests(){
  const b = createBoard(4,4); const shape = [[1,1],[1,1]];
  const t1 = canPlace(b, shape, 1, 1) === true;
  const t2 = canPlace(b, shape, 3, 3) === false;
  const merged = merge(b, shape, 0, 2);
  const cleared = clearLines([[1,1,1,1],[1,1,1,1],[0,1,1,1],[0,0,0,0]]);
  const t3 = cleared.lines === 2;
  const g = generateGarbage(20,10,5);
  const t4 = g.length===20 && g[0].length===10;
  const inv: Inventory = { I:1,O:0,T:0,S:0,Z:0,J:0,L:0 };
  const setInv = (nv:Inventory)=>{};
  const s = spawnFromInventory(inv, setInv);
  const t5 = s.piece !== null && s.consumed === 'I';
  let t6 = true;
  if (typeof document !== 'undefined'){
    const canvas = document.createElement('canvas'); canvas.width=100; canvas.height=200; const ctx = canvas.getContext('2d');
    if (ctx){ draw(ctx, { board: createBoard(20,10), piece: null, over:false, score:0 }); t6 = true; } else { t6 = false }
  }
  const all = [t1,t2,t3,t4,t5,t6];
  if (typeof window !== 'undefined') (window as any).__sparkTests = all;
  console.log("Spark tests:", all.every(Boolean));
}
