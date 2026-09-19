# SLOPS Sticker Booth 🏷️✨

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3-000000?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An interactive, local sticker booth web application where visitors enter a word or phrase, select typography styles, pick accessible color palettes, choose die-cut sticker shapes, and immediately export high-resolution, print-ready sticker PNGs.

Powered by a dual-runtime architecture: a fast **React + Vite** frontend orchestrating an **Express** proxy that delegates high-fidelity typography compositing to a native **Python** text-shaping engine using **HarfBuzz** and **FreeType**.

---

## ✨ Features

- **⚡ Live Interactive Preview**: Responsive canvas updating in real time as users type or change parameters.
- **🔤 Advanced Text Shaping**: Employs HarfBuzz (`uharfbuzz`) and FreeType (`freetype-py`) for OpenType font shaping, ligatures, kerning, and line metrics.
- **🎨 Accessible Color Presets**: Curated foreground and background combinations pre-checked against WCAG AA contrast standards ($\ge 4.5:1$).
- **✂️ Die-Cut Shapes & Cut Guides**: Choose between clean square canvas or die-cut circular badge shapes, complete with optional cut-line guides for sticker cutting machines.
- **📐 Smart Line Breaking**: Multi-word phrases automatically balance across lines for optimal visual weight and aesthetics.
- **🗂️ Dynamic Font Catalog**: Automatically scans and catalogs custom `.ttf` and `.otf` fonts by family and styles (`regular`, `bold`, `italic`, `bold-italic`).
- **📥 High-Resolution Export**: One-click download of 1024×1024 crisp die-cut transparent PNGs with sanitized, descriptive filenames.
- **🧩 Automated Process Management**: The Node server automatically launches, monitors, and proxies requests to the Python Flask microservice.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser / Client                      │
│                  React 19 + Tailwind CSS UI                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / WebSocket (Port 3000)
┌──────────────────────────────▼──────────────────────────────┐
│                    Express Proxy Server                     │
│    • Serves Vite SPA & static assets                        │
│    • Proxies /fonts, /font-file, /presets, /render          │
│    • Spawns & supervises Python backend child process       │
└──────────────────────────────┬──────────────────────────────┘
                               │ Internal HTTP (Port 8765)
┌──────────────────────────────▼──────────────────────────────┐
│                  Python Flask Engine                        │
│    • font_catalog: dynamic scanning of OTF/TTF fonts        │
│    • typography_core: HarfBuzz + FreeType rendering         │
│    • make_typography: layout, contrast math, PIL render     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```text
slops-sticker-booth/
├── src/                          # React frontend
│   ├── App.tsx                   # Main sticker booth interface
│   ├── FontPicker.tsx            # Font family & style selector
│   ├── Preview.tsx               # Sticker canvas & live preview card
│   ├── api.ts                    # REST client & types
│   ├── useRender.ts              # Debounced render hook
│   └── index.css                 # Tailwind styles
├── typography-scripts/           # Core Python sticker rendering engine
│   ├── fonts/                    # Bundled TTF/OTF font files
│   │   └── categories.json       # Script / handwriting font tags
│   ├── color_presets.json        # Curated color palettes with contrast
│   ├── font_catalog.py           # Font scanning and style resolution
│   ├── typography_core.py        # Text shaping and compositing logic
│   ├── make_typography.py        # High-level generation API & CLI
│   └── requirements.txt          # Python engine dependencies
├── server.ts                     # Express server & Python process supervisor
├── server.py                     # Flask HTTP wrapper around sticker engine
├── requirements.txt              # Root Python dependencies
├── package.json                  # Node dependencies and scripts
└── vite.config.ts                # Vite configuration
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or newer (LTS recommended)
- **Python**: `3.10` or newer
- **pip** and **npm**

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/slops-sticker-booth.git
   cd slops-sticker-booth
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   *(Optional but recommended: use a virtual environment before running `pip install`)*
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Install Node dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

---

## 🖥️ Running the Application

### Development Mode

Start both the Express frontend/proxy and the Python backend with a single command:

```bash
npm run dev
```

Open your browser at **[http://localhost:3000](http://localhost:3000)**. The Node server will automatically boot `server.py` in the background.

### Production Build

To build the client bundle and execute the production server:

```bash
npm run build
npm start
```

---

## 🔌 API Endpoints

The Express server forwards the following endpoints to the internal Python Flask service (`http://127.0.0.1:8765`):

| Endpoint | Method | Description |
|---|---|---|
| `/fonts` | `GET` | Returns list of available font families, categories, and supported styles. |
| `/font-file` | `GET` | Fetches raw font binary (`.ttf`/`.otf`) by `?family=` and `?style=`. |
| `/presets` | `GET` | Returns curated color pairs (`name`, `foreground`, `background`). |
| `/render` | `POST` | Renders sticker image. Returns `{ png_base64, warning }`. |

### Example Render Request Payload

```json
{
  "text": "Coffee First",
  "family": "Beautifully Delicious Sans",
  "style": "bold",
  "foreground": "#171717",
  "background": "#CBF3DC",
  "shape": "circle",
  "guide": true,
  "size": 1024
}
```

---

## 🎨 Customization

### Adding Custom Fonts

1. Drop any standard `.ttf` or `.otf` file into `typography-scripts/fonts/`.
2. *(Optional)* Tag cursive or display fonts by updating `typography-scripts/fonts/categories.json`:
   ```json
   {
     "My Custom Script Font": "script"
   }
   ```
3. Restart the server. The font catalog automatically registers the font and its available weights.

### Adding Color Presets

Edit `typography-scripts/color_presets.json` to add or modify color schemes:

```json
[
  {
    "name": "Matcha Cream",
    "foreground": "#1B3B2B",
    "background": "#E2F0D9"
  }
]
```

> **Note:** Ensure your chosen colors satisfy high contrast. The engine calculates contrast automatically and issues warnings if contrast falls below $4.5:1$.

---

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS v4](https://tailwindcss.com/), [Vite](https://vitejs.dev/), [Lucide React](https://lucide.dev/)
- **Application Server**: [Express](https://expressjs.com/), [Node.js Child Process](https://nodejs.org/api/child_process.html), [tsx](https://github.com/privatenumber/tsx), [esbuild](https://esbuild.github.io/)
- **Typography & Rendering**: [Flask](https://flask.palletsprojects.com/), [Pillow (PIL)](https://python-pillow.org/), [FontTools](https://github.com/fonttools/fonttools), [uHarfBuzz](https://github.com/fonttools/uharfbuzz), [FreeType-py](https://github.com/rougier/freetype-py)

---

## 📄 License

Distributed under the [MIT License](LICENSE). Feel free to use, modify, and distribute for your own events, booths, or projects!
