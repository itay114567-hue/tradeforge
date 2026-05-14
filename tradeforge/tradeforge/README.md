# ⚡ TradeForge

AI-powered trading strategy platform for NQ/ES futures traders.

**Features:**
- 🤖 AI Strategy Builder — Pine Script v6 generation via Claude
- 📊 Quant Lab — Monte Carlo simulation (500 paths)
- 📈 Strategy Analysis — CSV trade upload & stats
- 📓 Trading Journal — Prop firm challenge tracker

---

## 🚀 Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/tradeforge.git
cd tradeforge

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your Anthropic API key

# 4. Run dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 🔑 API Key

The AI chat module requires an [Anthropic API key](https://console.anthropic.com).

Add it to `.env.local`:
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

> ⚠️ Never commit your `.env.local` file. It's already in `.gitignore`.

---

## ☁️ Deploy to Vercel

### Option A — Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option B — Vercel Dashboard
1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repo
4. Add environment variable: `VITE_ANTHROPIC_API_KEY` → your key
5. Click **Deploy**

Vercel auto-detects Vite. No extra config needed.

---

## 🛠 Tech Stack

- **React 18** + **Vite**
- **Anthropic Claude API** (claude-sonnet-4-20250514)
- Pure CSS (no Tailwind, no UI library)

---

## 📁 Project Structure

```
tradeforge/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx        # React entry point
│   └── App.jsx         # Full app (components + styles)
├── .env.example        # Template for env vars
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```
