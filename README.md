# Sputnik Eco 🌍 🛰️

Sputnik Eco is an environmental monitoring web platform MVP. Users can log in, define territories on an interactive map, get real-time API-driven air quality data, analyze pollution levels, utilize **DeepSeek** and **ChatGPT** (OpenAI) for expert health recommendations, and generate shareable PDF reports.

## Tech Stack
- **Backend:** Python, FastAPI, SQLite (via SQLAlchemy), JWT Auth
- **AI Analysis:** DeepSeek (`deepseek-chat`) with fallback to ChatGPT (`gpt-4o-mini`) via the `openai` Python SDK
- **Frontend:** Vanilla HTML, CSS, JavaScript (no heavy frameworks)
- **Map:** Leaflet.js + Leaflet.draw
- **Charts:** Chart.js
- **PDF Generation:** WeasyPrint
- **Data Source:** Open-Meteo Air Quality API (free)

## Project Initialization & Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up Environment Variables:**
   Create a `.env` file in the root directory and add your API Keys:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   DEEPSEEK_API_KEY=your_deepseek_api_key_here
   ```
   > Note: The platform attempts to use DeepSeek by default. If DeepSeek is unavailable or the key is not set, it safely falls back to using ChatGPT.

3. **Start the server:**
   ```bash
   uvicorn main:app --reload
   ```

## Workflow & Features
1. **Login/Register:** Authentication using JWT via `passlib` bcrypt and `python-jose`.
2. **Dashboard:** Summarizes the territories, provides real-time averages, highlights high-risk areas identified by AI, and shows an overall score trend curve (Chart.js).
3. **Map & Analysis:** Use the polygon drawing tool via Leaflet to select custom environmental areas. Runs an intelligent data pipeline: 
   - `fetch_air_quality` pulls Open-Meteo PM2.5, PM10, NO2, SO2, CO, and O3 values.
   - `calc_score` creates a weighted 0-100 environmental score based on WHO indices.
   - `run_ai_analysis_safe` securely communicates with DeepSeek/ChatGPT to compile trend analysis, risk level, forecasts, and actionable recommendations.
4. **Reports:** Instantly compile the analysis (including AI summaries) into downloadable professional PDFs built rapidly via custom pure HTML/CSS and WebpyPrint.
