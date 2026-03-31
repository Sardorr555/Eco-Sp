from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import create_tables
from routers import auth_router, territories, analysis, reports
import os
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Sputnik Eco")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

create_tables()

app.include_router(auth_router.router, prefix="/api/auth")
app.include_router(territories.router, prefix="/api/territories")
app.include_router(analysis.router, prefix="/api/analysis")
app.include_router(reports.router, prefix="/api/reports")

# Need to ensure directories exist
os.makedirs("static/reports", exist_ok=True)
os.makedirs("frontend", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/app", StaticFiles(directory="frontend", html=True), name="frontend")

@app.get("/")
def root():
    return FileResponse("frontend/index.html")
