# 🚀 Spark Plug MVP (火花塞)

A productivity app combining **smart task prioritization**, **Pomodoro timer**, and **gamified Tetris rewards**.

## ✨ Features

- **Priority Panel**: Auto-ranks tasks by Impact, Urgency, Energy Fit, and Complexity
- **Focus Panel**: Pomodoro timer with automatic breaks and session tracking
- **Reward Panel**: Earn Tetris pieces by completing tasks, play to relax

## 🛠️ Tech Stack

Next.js 14+ • TypeScript • Tailwind CSS • shadcn/ui • localStorage

## 📦 Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🎯 Usage

1. **Add tasks** in Priority tab → Adjust sliders → Tasks auto-rank by score
2. **Start focus session** in Focus tab → Select task → Work until timer ends
3. **Complete tasks** → Earn random Tetris pieces → Play in Reward tab

## 📂 Project Structure

```
spark_ignite_2/
├── app/
│   ├── page.tsx            # Main app (all 3 panels)
│   ├── layout.tsx          # Root layout
│   └── globals.css         # Tailwind styles
├── components/ui/          # shadcn/ui components
└── package.json
```

## 🔧 Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Run production |

## 💾 Storage

All data stored in browser localStorage. Keys: `sp.tasks`, `sp.weights`, `sp.rewards`, `sp.logs`, `sp.tetris.inv`

## 📝 License

MIT

---

**v0.21** • Made with ❤️ for productive humans
