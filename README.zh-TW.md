# THE ARC

**一支 68 秒、完全用程式碼做成的影片：人類武器的歷史，從第一件石器到核戰。**
畫面由 WebGL（three.js）即時算出，配樂用 Python 合成，沒有任何實拍素材、取樣音源或素材庫。
每一個剪接、填滿和閃光都對準配樂的節拍。

[English README → README.md](README.md)

> ▶ **觀看影片：** 請到最新的 [Release](../../releases) 下載（附 1080p60 影片）。

作者：**[jasontzeng123](https://github.com/jasontzeng123)**。渲染引擎改自 [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video)（MIT 授權）。本片與 Claude（Anthropic）共同設計與製作。

---

## 影片內容

整部片只講一件事：**弧線（THE ARC）**。它是丟出的石頭、弓箭、砲彈、子彈，最後是彈道飛彈飛行的路徑。每個時代只放一個數字，合起來量出殺戮變得多容易、距離又變得多遠。

| # | 時間（秒） | 段落 | 畫面 |
|---|---|---|---|
| 01 | 0–8 | 石器 | 一顆卵石一下一下被敲成手斧，裝上柄後擲出，弧線開始 |
| 02 | 8–14 | 弓 | 鏡頭拉遠 10 倍，兩波箭雨準確落在配樂的重拍上 |
| 03 | 14–20 | 金屬 | 青銅與鐵的晶格，隨鐵砧敲擊節奏變化，最後熔成一把劍 |
| 04 | 20–26 | 火藥 | 最早的火藥配方、大砲射程表、君士坦丁堡的城牆 |
| 05 | 26–32 | 槍 | 射速變成節奏：燧發槍每分鐘 3 發 → 加特林 → 馬克沁 → 迷你砲每分鐘 6,000 發 |
| 06 | 32–40 | 世界大戰 | 一格 = 1,000 條人命的帳本，一戰、二戰逐漸填滿；最後是廣島：一顆炸彈 |
| 07 | 40–48 | 精準 | 摧毀一個目標，從 9,000 顆炸彈變成 1 顆；接著是武裝無人機與 GPS 衛星 |
| 08 | 48–54 | 核武庫 | 12,187 枚核彈頭排成矩陣；一次發射，30 分鐘的飛行壓縮成 3.4 秒 |
| 09 | 54–58 | 引爆 | 閃光，0.55 秒後才到的衝擊波，等高線構成的蕈狀雲 |
| 10 | 58–68 | 終章 | 全球發射，鏡頭每一小節往後拉一次，直到 *HUMAN* 消失 |

每段都疊有該武器的剪影圖示，在拍點上切換（`app/src/scenes/_icons.ts`）。

## 快速開始

需要安裝：

- **[Bun](https://bun.sh) 1.2 以上**：用來建置與執行渲染器
- **[ffmpeg](https://ffmpeg.org)**：用來編碼影片
- **Python 3.10 以上**：只有想重新產生配樂或資料時才需要，先執行 `pip install -r requirements.txt`

```sh
cd app
bun install
bunx playwright install chromium   # 離線渲染用的無頭瀏覽器

# 即時預覽 → 瀏覽器打開 http://localhost:5173
bun run build
bun run serve
```

預覽操作：

- **空白鍵**：播放 / 暫停
- **← / →**：跳 1 秒（按住 shift 跳 5 秒）
- **, / .**：逐格
- **[ / ]**：上一段 / 下一段
- **l**：循環目前段落
- **h**：隱藏介面

改完程式後重新執行 `bun run build`，或在另一個終端機開著 `bun run watch`。

### 輸出影片

```sh
cd app
bun run render        # → out/the-arc.mp4     1920×1080、60 fps、3 次取樣動態模糊
bun run render:4k     # → out/the-arc-4k.mp4  3840×2160（真正的 4K：全部重新計算，不是放大）

# 製作時檢查單格 / 縮圖拼貼
bun scripts/render.ts stills --t 11,24.5,39 --out ../out/stills/test
../tools/stills.sh test "11,24.5,39"     # 同上，另外產生 grid.jpg 拼貼
```

渲染器會在無頭 Chrome 裡開啟這個程式，對每個時間點 *t* 算出畫面，再透過 WebSocket 串流給 ffmpeg 編碼。

- **GPU：** Chrome 預設會使用 GPU；加上 `--swiftshader` 會強制使用軟體算圖，比較慢，但每台電腦的結果完全相同。
- **渲染時間：** 完整 1080p、含動態模糊，在只有 CPU 的雲端機器上（軟體 WebGL）約 2.5 小時；有顯示卡的電腦會快很多。4K 約需 4 倍時間。
- **部分輸出：** `--from 54 --to 68` 只輸出其中一段；`--samples 1` 關掉動態模糊，適合快速預覽。

### 重新產生配樂

```sh
python3 music/score.py            # → audio/score.wav + data/audio.json（約 10 秒）
STEMS=1 python3 music/score.py    # 另外輸出 music/out/stems_ending/（終章每個樂器各一軌）
```

`music/score.py` 就是整首配樂的程式碼。速度 120 BPM、D 弗里吉亞調式，一小節 = 2 秒，影片的每個剪接點都落在小節的第一拍。樂器是 `music/synth.py` 裡的小型合成器：大鼓、小鼓、踩鑔、貝斯、和弦鋪底、鐵砧、轟擊、呼嘯聲、無限上升音和核爆聲。

配樂同時會輸出 **`data/audio.json`**，記錄每一拍、每一小節、音量包絡，以及每個音樂事件的精確時間（每次敲石、箭雨、鎖定嗶聲、發射……）。畫面讀取這份資料來對拍（例如 `audio.hit('kick', t)`），所以動畫會精準落在聲音上，不靠目測。

### 重新產生資料（選用，結果已經放在 `data/`）

```sh
tools/fetch_sources.sh              # 下載 Natural Earth 與日本行政區界 → vendor/
python3 tools/globegen.py           # data/globe.json      終章地球的海岸線與陸地點
python3 tools/hirogen.py            # data/hiroshima.json  廣島縣與周邊縣（只畫縣界與海岸線）
python3 tools/citygen.py            # data/city2a.json + data/cityplana.png  第 07 段的規劃城市
python3 tools/icons/build_all.py    # app/src/scenes/icons.json  武器圖示（另輸出 out/icons_sheet.png 預覽）
```

## 製作方式

```
app/                 渲染器（TypeScript、three.js）
  src/engine/        引擎：時間軸、確定性時間、動態模糊累積、轉場、後製（光暈、顆粒…）
  src/scenes/        每段一個檔案（stone.ts … finale.ts）與共用元件（_kit.ts、_globe.ts、_city2.ts、_icons.ts…）
  src/timeline.ts    剪接表：每段何時播放、段落間用什麼轉場
  scripts/           render.ts（無頭離線渲染）、serve.ts（靜態伺服器）
music/               配樂（Python）：synth.py = 樂器，score.py = 編曲、混音與分析
tools/               資料產生器（城市、地圖、地球、圖示）與縮圖拼貼工具
data/                渲染器讀取的資料（audio.json、地圖、城市、地球）
audio/score.wav      算好的配樂
```

- **確定性：** 每一格畫面只取決於時間 *t*，有狀態的效果會先預跑，所以任何一格都能單獨、依任意順序算出，每次輸出都一樣。
- **對準聲音，不靠猜：** 配樂輸出它演奏的每個事件的時間，畫面直接讀這些時間。
- **統一的視覺系統：**
  - **色彩：** 墨黑、骨白加一個訊號橘（`app/src/engine/palette.ts`）。
  - **字體：** Archivo 與 IBM Plex Mono。
  - **線條：** 全部由同一套線條渲染器畫出（`engine/lines.ts`）。
  - **後製：** 顆粒、光暈、暗角統一在後製處理。
- **全部程式生成：**
  - 被敲打的石頭是一組半空間切割。
  - 死亡帳本是 shader。
  - 城市一條街一條街生成。
  - 蕈狀雲是一圈圈等高線。

## 畫面上的數字

以下是片中出現的數字，都是四捨五入、廣為引用的估計值，轉用前請查證原始出處。

- **考古發現：**
  - 第一件石器約 330 萬年前：肯亞 Lomekwi 3。
  - 裝柄矛頭約 50 萬年前：南非 Kathu Pan。
  - 弓箭約 6.4 萬年前：南非 Sibudu 洞穴。
- **金屬：** 青銅（銅 88 %、錫 12 %）約西元前 3300 年起；鐵約西元前 1200 年起（熔點 1,538 °C）。
- **火藥與大砲：**
  - 火藥配方：《武經總要》，1044 年。
  - 現存最古老的火砲：黑龍江手銃，約 1288 年。
  - 君士坦丁堡：1453 年，圍城 53 天後城牆被攻破。
- **射速（每分鐘發數）：**
  - 燧發槍約 3 發
  - 加特林機槍（1862 年）約 200 發
  - 馬克沁機槍（1884 年）約 600 發
  - M134 迷你砲（1963 年）最高約 6,000 發
- **死亡人數：**
  - 一戰：估計 1,500–2,200 萬人。
  - 二戰：估計 7,000–8,500 萬人。
  - 廣島（1945 年 8 月 6 日）：一顆 15 千噸的原子彈，到 1945 年底死亡 9–16.6 萬人。
- **現代武器：**
  - 雷射導引精準轟炸：1991 年。
  - 武裝 MQ-1 無人機：2001 年。
  - GPS：31 顆衛星，高度 20,200 公里。
  - 洲際飛彈：1957 年。
- **核武庫：** 核彈頭 12,187 枚（SIPRI 年鑑），其中約 2,100 枚處於高度戒備。

## 致謝與授權

- **程式碼：** [MIT](LICENSE)，涵蓋渲染器、配樂產生程式和工具。引擎部分 © 2026 Giacomo Magnanini（[pdoom-video](https://github.com/mexicat/pdoom-video)，MIT）。
- **影片與配樂**（算好的影片、`audio/score.wav`，以及配樂程式算出的任何聲音）：[CC BY-NC 4.0](LICENSE-MEDIA.md) © 2026 jasontzeng123。只要標註作者，就可以在非商業用途下分享與改作。
- **字體：** Archivo、IBM Plex Mono、Cormorant，採 SIL Open Font License（`app/public/fonts/OFL.txt`）。
- **地圖資料：**
  - [Natural Earth](https://www.naturalearthdata.com)（公有領域）。
  - 日本縣界：「国土数値情報（行政区域データ）」国土交通省，經 [niiyz/JapanCityGeoJson](https://github.com/niiyz/JapanCityGeoJson) 轉換後加工製作。

詳見 [CREDITS.md](CREDITS.md)。
