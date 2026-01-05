"""
Aman AI Platform - FastAPI Backend
Main application entry point.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.endpoints import analysis
from app.core.config import settings
from app.db import init_db, shutdown_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    print(f"Starting Aman AI Backend v{settings.VERSION}")
    await init_db()
    yield
    await shutdown_db()
    print("Shutting down Aman AI Backend")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI Platform for Neurodiagnostics and Rehabilitation",
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# WebSocket endpoints (mounted at root for frontend compatibility)
app.include_router(analysis.router, prefix="/ws", tags=["WebSocket Analysis"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "service": "aman-ai-backend",
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to Aman AI Platform API",
        "docs": f"{settings.API_V1_STR}/docs",
        "version": settings.VERSION,
    }
