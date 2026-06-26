# Handoff: Multi-Portfolio Tracker ("Porto")

## Overview
A personal net-worth & investment tracker that aggregates **multiple portfolios** (e.g. เก็บออม / ลงทุนระยะยาว / Gamble), each holding assets of **five types** — Crypto, หุ้นไทย (Thai stocks), หุ้น US (US stocks/ETFs), กองทุน (mutual funds), and เงินฝาก (cash/deposits). It records **buy/sell transactions** (computing average cost per holding), pulls **live prices** (CoinGecko + Yahoo Finance), tracks **liabilities**, and shows **Net Worth = Assets − Liabilities**. The Overview has a hero net-worth chart plus four charts; a per-asset price-history chart is available on demand. A local **login** gates the app. Currency can toggle THB/USD. All data persists in `localStorage`.

UI language: **Thai with English finance terms** (Net Worth, P&L, Transactions, etc.).

## About the Design Files
The file in this bundle — `Portfolio Tracker.dc.html` — is a **design reference created in HTML** (a working prototype showing intended look and behavior). It is **not production code to ship directly**. The task is to **recreate this design in the target codebase's environment** (React, Vue, SwiftUI, etc.) using that project's established patterns, component library, charting library, and data layer. If no environment exists yet, pick the most appropriate stack (e.g. React + TypeScript + a charting lib like Recharts/visx) and implement there.

> Note: the prototype is authored as a "Design Component" (`.dc.html`) with a small custom template/logic runtime. **Ignore the `.dc.html` mechanics** — read the template markup and the `class Component` logic as a spec for layout + behavior, and reimplement idiomatically.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, copy, chart styles, and interaction logic are all defined. Recreate the UI faithfully using the codebase's libraries. The price-fetching and average-cost math should be reproduced exactly (see State Management).

## Screens / Views

### 1. Login (`showLogin`)
- **Purpose:** Gate access; sign up or sign in (local account), or enter demo mode.
- **Layout:** Full-height two-column flex, `flex-wrap: wrap`. Left brand panel `flex: 1 1 380px`; right form panel `flex: 1 1 420px`. Stacks to one column on narrow screens.
- **Left brand panel:** warm gradient `linear-gradient(160deg, #b45a3c 0%, #8f4630 55%, #5e3322 100%)`, text `#faf5ec`, padding `56px 52px`. Logo (28–30px circle `#faf5ec` + "Porto" 19px/700). Headline `clamp(26px,3.2vw,38px)`/700, body `rgba(250,245,236,0.82)` 15px/1.7, and a 3-stat row (5 ประเภทสินทรัพย์ / ∞ พอร์ตไม่จำกัด / 100% เก็บในเครื่องคุณ).
- **Right form panel:** bg `#FAF5EC`, centered card `max-width: 380px`. Title `{authTitle}` 24px/700, subtitle 14px `#8a7d6c`. Fields: (signup only) ชื่อ, then อีเมล, รหัสผ่าน. Inputs: `padding 12px 16px`, `border-radius 14px`, `border 1px solid #e0d5c2`, bg `#fff`. Primary button full-width `#b45a3c`/`#fff`, `border-radius 999px`. Divider "หรือ". Secondary "เข้าใช้งานแบบเดโม" button bg `#f0e7d8`/`#6b5d49`. Toggle link signup⇄signin. Footer note that the account is local-only.
- **Validation:** name required (signup); email must match `/.+@.+\..+/`; password ≥ 4 chars. Sign-in checks email+password against stored account.

### 2. Overview (`page = 'overview'`)
- **Purpose:** At-a-glance net worth, trend, allocation, P&L, portfolios.
- **Layout:** Centered column, `max-width: 1200px`.
  - **Hero:** centered. Label "ความมั่งคั่งสุทธิของคุณ (Net Worth)"; value `clamp(34px,6vw,52px)`/700 tabular-nums; a change pill (green `#e4efdb`/`#4f7136` up, red `#f3ded6`/`#b4543c` down) + "อัปเดตล่าสุด … · CoinGecko + Yahoo Finance".
  - **Mini stats row** (3 white `border-radius:16px` cards): Total Assets, Liabilities (`#84422e`), P/L วันนี้ (green/red).
  - **Net-worth area chart** (full width SVG, viewBox `0 0 1100 170`): area fill `#c97a52` gradient (0.32→0), stroke `#b45a3c` 3px, end dot. 5 month labels below.
  - **Portfolio cards** grid (`repeat(auto-fit, minmax(270px,1fr))`): each tinted card (palette tints below) with name, return pill, value (26px/700), type summary, a thin progress bar (% of total assets), and "% ของสินทรัพย์รวม". Clicking opens Portfolios.
  - **Four charts** grid (`repeat(auto-fit, minmax(310px,1fr))`):
    1. **สัดส่วนตามพอร์ต** — donut via `conic-gradient` (segments per portfolio), white center hole showing portfolio count + abbreviated total; legend list with %.
    2. **กำไร/ขาดทุน รายสินทรัพย์ (Unrealized)** — vertical bars (top 7 by |P&L|), green shades up / red shades down, value label above each bar (e.g. +124.5k).
    3. **Assets vs Liabilities** — dark card `#3d3328`: two labeled bars (assets `#a3b87a` full width, liabilities `#d98f70` scaled to debt ratio) + "อัตราหนี้ต่อสินทรัพย์" with note (good < 30%, caution < 50%, high ≥ 50%).
  - **Empty state** (no assets): card with "+ สร้างพอร์ต" and "โหลดข้อมูลตัวอย่าง".

### 3. Portfolios (`page = 'ports'`)
- **Purpose:** Manage portfolios and holdings.
- Header with "+ เพิ่มสินทรัพย์" and "+ สร้างพอร์ต". One white card per portfolio: colored dot, name, total value, return pill, "+ สินทรัพย์", "ลบพอร์ต".
- **Allocation bar (chart):** when a portfolio has ≥2 holdings, a horizontal stacked bar (height 12px, `border-radius:999px`, track `#f7f0e3`) sits below the header — one segment per holding sized to its share of the portfolio's value, colored from the portfolio/series palette. A wrap-flow legend of chips follows (color swatch + symbol + integer %).
- Holdings **table** (min-width 860px, horizontal scroll) columns: สินทรัพย์ (sym + type·name) / จำนวน / ต้นทุนเฉลี่ย / ราคา / มูลค่า / P&L (green/red) / actions. Actions: **ซื้อ/ขาย** (opens tx modal), **กราฟ** (crypto/th/us only → chart modal), **NAV** (fund only → price modal), **✕** delete.

### 4. Transactions (`page = 'tx'`)
- Reverse-chronological table (min-width 820px): วันที่ / ประเภท (ซื้อ·ขาย or ฝาก·ถอน for deposits, colored pill) / สินทรัพย์ / พอร์ต / จำนวน / ราคา / มูลค่ารวม / ✕. Empty state when none.

### 5. Liabilities (`page = 'debt'`)
- Dark `#3d3328` summary strip: สินทรัพย์รวม (`#a3b87a`) − หนี้สินรวม (`#d98f70`) = Net Worth (`#faf5ec`).
- **Debt composition (chart):** when ≥1 liability exists, a white card with a `conic-gradient` **donut** (150px, white center hole showing หนี้สินรวม total) beside a legend list (swatch + name + amount + % of total). Donut/legend use the debt palette below.
- List of liability rows (name + amount + ✕). "+ เพิ่มหนี้สิน".

### 6. Settings (`page = 'settings'`)
- **Purpose:** Choose the app's visual **theme**. Accessed via the "ตั้งค่า" nav tab.
- **Layout:** centered column. A grid of theme cards (`repeat(auto-fit, minmax(220px,1fr))`). Each card shows the theme name, a one-line description, a small set of swatches previewing that theme's brand/secondary/accent colors, and a selected state (highlighted border + check) when active. Clicking a card sets `data.theme` and re-themes the entire app instantly.
- **Themes:** `sunset` (warm terracotta — default), `ocean` (teal/green), `berry` (magenta/plum). See **Theming** below for the full token values.

### Persistent chrome (when logged in)
- **Top nav** (sticky, bg `#FAF5EC`, border-bottom `#eee3d2`): logo, tabs (ภาพรวม / พอร์ต / Transactions / หนี้สิน / ตั้งค่า) with active = 700 + 2px `var(--brand)` underline, THB/USD pill toggle (active pill `#3d3328`/`#faf5ec`), "+ เพิ่มรายการ" (`#b45a3c`), "ออกจากระบบ" (outline).
- **Live ticker** (bg `#3d3328`): horizontally-scrolling row of `{symbol} {nativePrice} {±24h%}` (green `#c9e08a` / red `#f0a98f`) for every crypto/stock holding with a price, plus USD/THB. Right side: "● LIVE · อัปเดต HH:MM" + รีเฟรช button. A warning strip appears if any fetch failed.

### Modals (overlay `rgba(61,51,40,0.45)`, card bg `#FAF5EC`, `border-radius:24px`, `max-width:440px`; chart modal `640px`)
- **Transaction:** asset select, Buy/Sell segmented toggle (deposit → ฝาก/ถอน), quantity, price per unit (hidden for deposit), fee, date.
- **Add asset:** portfolio select, type select (crypto/th/us/fund/deposit), symbol, optional name, CoinGecko ID (crypto, with built-in symbol→id map), NAV (fund). **Opening-buy section** (optional): จำนวน / ราคาต่อหน่วย / ค่าธรรมเนียม / วันที่ + live **Total spent**; if filled, records the first transaction immediately, else opens the Transaction modal prefilled.
- **Create portfolio:** name.
- **Add liability:** name + amount (THB).
- **Update NAV/price:** manual price for funds.
- **Price-history chart:** title (symbol + name·type), range tabs 7D/1M/3M/1Y, current price + range % change + high/low, area+line SVG (viewBox `0 0 640 190`, same warm palette), a dashed teal `#5b8a8f` **average-cost line** with label, and date labels. Loading and error states.

## Interactions & Behavior
- **Navigation:** tab click sets `page`. Portfolio card click → Portfolios.
- **Currency toggle:** THB/USD recomputes all displayed money. FX rate derived live (BTC thb/usd ratio from CoinGecko) with fallback ~35.84.
- **Auto-refresh:** prices refetch on login and every **120s**; manual refresh button. On failure, keeps last saved prices and shows a warning strip.
- **Price chart:** opens per holding; switching range refetches. Crypto = CoinGecko `market_chart`; stocks = Yahoo `chart` via CORS proxy (may fail → error state).
- **Validation:** sell cannot exceed held quantity; positive numbers required; crypto requires a resolvable CoinGecko id.
- **Confirmations:** deleting asset/portfolio/transaction/liability uses confirm dialogs; deleting an asset also removes its transactions; a portfolio must be empty before deletion.
- **Responsive:** grids use `auto-fit minmax`; tables scroll horizontally on mobile; login stacks.

## State Management
Single store persisted to `localStorage["porto-tracker-v1"]`:
```
{ portfolios:[{id,name,color}],
  assets:[{id,pid,type,sym,name,ccy,cg?,ysym?,manualPrice?}],
  transactions:[{id,aid,side:'buy'|'sell',qty,price,fee,date}],
  liabilities:[{id,name,amount}],
  history:[{d:'YYYY-MM-DD', v:netWorth}],
  prices:{ [assetId]: {price, chg, t} },   // price in native ccy
  fx, lastUpdated, cur:'THB'|'USD', theme:'sunset'|'ocean'|'berry', seq }
```
Auth persisted separately to `localStorage["porto-auth-v1"]` = `{ name, email, pass, loggedIn, demo? }` (local only — replace with real auth in production).

**Average-cost engine (`position(assetId)`):** process that asset's transactions oldest→newest. On **buy**: `cost += qty*price + fee; qty += qty`. On **sell**: `avg = cost/qty; realized += sellQty*(price-avg) - fee; cost -= avg*sellQty; qty -= sellQty` (clamp to 0). Returns `{ qty, avg = qty>0?cost/qty:0, realized }`.

**Valuation:** `priceOf(asset)` = deposit→1, else live `prices[id].price`, else `manualPrice`, else avg cost. Value in display currency multiplies USD assets by `fx`. `totals()` → `{assets, liab, nw, day, cost}`; `day` (today's P/L) from each asset's 24h `chg`.

**Net-worth history:** on each refresh, upsert today's `{d, v:nw}` into `history` (used by the hero chart and month-over-month change vs the value ~28 days ago).

## Data Fetching
- **CoinGecko (CORS-open):**
  - Spot: `GET /api/v3/simple/price?ids={csv}&vs_currencies=thb,usd&include_24hr_change=true`. FX = bitcoin.thb / bitcoin.usd.
  - History: `GET /api/v3/coins/{id}/market_chart?vs_currency=thb&days={7|30|90|365}` → `prices:[[ts,price]]`.
  - Symbol→id map is bundled (BTC→bitcoin, ETH→ethereum, SOL→solana, …); users can override with an explicit CoinGecko id.
- **Yahoo Finance (needs CORS proxy):** `GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval={i}&range={r}` via proxies (`corsproxy.io`, `allorigins.win`). Thai stocks use `{SYM}.BK`. Spot reads `result[0].meta.regularMarketPrice` + `chartPreviousClose`; history reads `timestamp[]` + `indicators.quote[0].close[]`. **In production, proxy these server-side** (your own backend / edge function) instead of public proxies, or use a paid market-data API.

## Theming (IMPORTANT — colors are tokenized)
The prototype does **not** hardcode colors per element. It defines a set of **CSS custom properties** (design tokens) and renders everything through `var(--token)`. Three themes redefine the same token names; the active theme is applied by setting `data-theme="{sunset|ocean|berry}"` on the root element (driven by `data.theme`, default `sunset`). **Reproduce this as a theme/token layer in your codebase** (CSS variables, a theme object, Tailwind theme, design-tokens file, etc.) — do not bake hex values into components.

Token names (same across all themes): `--bg --bg-alt --surface --text --text2 --muted --muted2 --muted3 --border --brand --brand-d --brand-dd --secondary --secondary-l --soft --soft-h --gain --gain-d --gain2..5 --gain-bg --ticker-up --loss --loss-d --loss2 --loss-bg --loss-l --gold --rose`.

**Theme palettes** (key tokens; full set is in the `<style>` block of the HTML — three one-line `[data-theme=...]` rules):
- **sunset** (default, warm): `--bg #FAF5EC` · `--surface #fff` · `--text #3D3328` · `--muted #8A7D6C` · `--border #E0D5C2` · `--brand #EC6530` (`--brand-d #C24A1E`, `--brand-dd #9A3614`) · `--secondary #FFAE6E` · `--gain #1E9396` · `--loss #C73B22`.
- **ocean** (cool teal): `--bg #F1F6F7` · `--text #1F3A40` · `--muted #6E898F` · `--border #D3E2E3` · `--brand #0E8C8F` (`-d #0A6E70`, `-dd #064D4F`) · `--secondary #46C2C4` · `--gain #2E9E6B` · `--loss #E0604A`.
- **berry** (magenta/plum): `--bg #FAF4F7` · `--text #33222E` · `--muted #8A7682` · `--border #E6D6DF` · `--brand #C2316B` (`-d #9C2455`, `-dd #6E1A3C`) · `--secondary #F072A0` · `--gain #2E9E6B` · `--loss #D23B3B`.

The per-element hex values quoted in the **Screens** section above describe an earlier single-palette draft and are now **indicative only** — treat the token names as the source of truth and pull actual values from the active theme.

The **category color arrays** (portfolio/series palette, card tints, P&L bar greens/reds, donut segments) are also theme-aware: each theme defines its own `palette` / `tints` / `greens` arrays in the `THEMES` object in the logic class. Read those arrays per theme rather than the single list below.

## Design Tokens (sunset / default values)
**Colors**
- Surface / app bg: `#FAF5EC` · card white: `#ffffff` · dark surface: `#3d3328`
- Primary (terracotta): `#b45a3c` (hover ~`#a04e32`); deep gradient stops `#8f4630`, `#5e3322`
- Text: primary `#3d3328`, muted `#8a7d6c`, faint `#a89a86` / `#b3a692`
- Inputs: border `#e0d5c2`, chip/secondary bg `#f0e7d8` (text `#6b5d49`)
- Positive: text `#4f7136`, bg `#e4efdb`; Negative: text `#b4543c`, bg `#f3ded6`
- Accent line (avg cost): `#5b8a8f`
- Card tints (per portfolio, cycle): `#EFF3E6 #F3E9DC #F2E0D8 #E2EDEA #EAE4F0 #F2E2E8`
- Portfolio/series palette (cycle): `#7a8f55 #c08b4f #b45a3c #5b8a8f #8a6f9e #a85d77`
- P&L bar greens: `#7a8f55 #93a86b #b3c48d #cdd9b3 #dde5cc`; reds: `#c4654a #dca08c #e6bcae`
- Chart area gradient: `#c97a52` 0.30→0

**Typography:** Anuphan (Google Fonts), weights 400/500/600/700. Numbers use `font-variant-numeric: tabular-nums`. Scale: hero `clamp(34px,6vw,52px)`, section titles 22px, card titles 14–16px, body 13–15px, labels 11.5–12.5px.

**Radius:** inputs 12–14px · cards 16–22px · modal 24px · pills/buttons 999px.
**Spacing:** card padding 18–24px · grid gaps 12–16px.
**Shadows:** essentially flat (rely on tint/contrast), modal sits over a `rgba(61,51,40,0.45)` scrim.

## Assets
No raster/SVG art assets — logo is a simple circle + wordmark; all charts are inline SVG/`conic-gradient`. Only external dependency is the **Anuphan** webfont. Use your codebase's icon set if you add icons.

## Screenshots
Reference renders of the prototype (in `screenshots/`):

| File | Screen |
|------|--------|
| `01-view.png` | Login (sign up / sign in / demo) |
| `02-view.png` | Overview — hero Net Worth, mini stats, live ticker, net-worth chart |
| `03-view.png` | Portfolios — per-portfolio allocation bar + holdings tables with avg cost & P&L |
| `04-view.png` | Transactions list |
| `05-view.png` | Liabilities — debt-composition donut + Net Worth summary |
| `06-view.png` | Add-asset modal (incl. optional opening-buy fields) |
| `07-view.png` | Price-history chart modal (range tabs + dashed average-cost line) |

> Numbers shown vary with live market data at capture time; treat them as illustrative, not fixed copy.

## Files
- `Portfolio Tracker.dc.html` — the full hifi prototype (template markup = layout spec; the `class Component` block = behavior/state/fetch spec). Read both; reimplement in your stack.
- `screenshots/01-view.png` … `07-view.png` — reference renders (see table above).
