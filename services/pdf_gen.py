from weasyprint import HTML
from models import Analysis
import os

REPORTS_DIR = "static/reports"
os.makedirs(REPORTS_DIR, exist_ok=True)

def score_color(score):
    if score >= 80: return "#00c9a7"
    if score >= 60: return "#4f8ef7"
    if score >= 40: return "#f5a623"
    return "#f05252"

async def generate_pdf(analysis: Analysis, title: str) -> str:
    t = analysis.territory
    color = score_color(analysis.overall_score)

    html = f"""
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background: #080d1a; color: #e8edf5; }}
      .cover {{ padding: 60px 48px; background: #0e1525; min-height: 200px; border-bottom: 3px solid {color}; }}
      .cover h1 {{ font-size: 28px; margin-bottom: 8px; color: {color}; }}
      .cover .sub {{ color: #7a8ba0; font-size: 14px; margin-bottom: 32px; }}
      .score-circle {{ display: inline-block; width: 80px; height: 80px; border-radius: 50%;
        border: 4px solid {color}; text-align: center; line-height: 80px; font-size: 32px; font-weight: 700; color: {color}; }}
      .section {{ padding: 32px 48px; }}
      .section h2 {{ font-size: 16px; text-transform: uppercase; letter-spacing: 1px; color: {color}; margin-bottom: 20px; }}
      table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
      th {{ text-align: left; padding: 10px 12px; background: #162036; color: #7a8ba0; font-weight: 600; }}
      td {{ padding: 11px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }}
      .good {{ color: #00c9a7; }} .moderate {{ color: #f5a623; }} .poor {{ color: #f05252; }}
      .footer {{ padding: 24px 48px; color: #7a8ba0; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.07); }}
    </style></head><body>
    <div class="cover">
      <div class="score-circle">{analysis.overall_score}</div>
      <h1>{title}</h1>
      <div class="sub">Territory: {t.name if t else ''} &nbsp;|&nbsp; Period: {analysis.date_from} → {analysis.date_to} &nbsp;|&nbsp; Status: {analysis.label}</div>
    </div>
    <div class="section">
      <h2>Air Quality Metrics</h2>
      <table>
        <tr><th>Pollutant</th><th>Measured (μg/m³)</th><th>WHO Limit</th><th>Status</th></tr>
        <tr><td>PM2.5</td><td>{analysis.pm25}</td><td>5</td><td class="{'good' if analysis.pm25 <= 5 else 'moderate' if analysis.pm25 <= 15 else 'poor'}">{'✓ Good' if analysis.pm25 <= 5 else '⚠ Moderate' if analysis.pm25 <= 15 else '✗ Poor'}</td></tr>
        <tr><td>PM10</td><td>{analysis.pm10}</td><td>15</td><td class="{'good' if analysis.pm10 <= 15 else 'moderate' if analysis.pm10 <= 45 else 'poor'}">{'✓ Good' if analysis.pm10 <= 15 else '⚠ Moderate' if analysis.pm10 <= 45 else '✗ Poor'}</td></tr>
        <tr><td>NO₂</td><td>{analysis.no2}</td><td>10</td><td class="{'good' if analysis.no2 <= 10 else 'moderate' if analysis.no2 <= 25 else 'poor'}">{'✓ Good' if analysis.no2 <= 10 else '⚠ Moderate' if analysis.no2 <= 25 else '✗ Poor'}</td></tr>
        <tr><td>SO₂</td><td>{analysis.so2}</td><td>40</td><td class="{'good' if analysis.so2 <= 40 else 'moderate' if analysis.so2 <= 125 else 'poor'}">{'✓ Good' if analysis.so2 <= 40 else '⚠ Moderate' if analysis.so2 <= 125 else '✗ Poor'}</td></tr>
        <tr><td>CO</td><td>{analysis.co}</td><td>100</td><td class="{'good' if analysis.co <= 100 else 'moderate' if analysis.co <= 1000 else 'poor'}">{'✓ Good' if analysis.co <= 100 else '⚠ Moderate' if analysis.co <= 1000 else '✗ Poor'}</td></tr>
        <tr><td>O₃</td><td>{analysis.o3}</td><td>60</td><td class="{'good' if analysis.o3 <= 60 else 'moderate' if analysis.o3 <= 100 else 'poor'}">{'✓ Good' if analysis.o3 <= 60 else '⚠ Moderate' if analysis.o3 <= 100 else '✗ Poor'}</td></tr>
      </table>
    </div>
    <div class="footer">Data source: Open-Meteo Air Quality API (Copernicus Atmosphere Monitoring Service) &nbsp;|&nbsp; Sputnik Eco Platform &nbsp;|&nbsp; Generated {analysis.created_at.strftime('%Y-%m-%d')}</div>
    </body></html>
    """

    path = f"{REPORTS_DIR}/report_{analysis.id}.pdf"
    HTML(string=html).write_pdf(path)
    return path
