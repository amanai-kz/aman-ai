"""
API Router - combines all service routers
"""

from fastapi import APIRouter

from app.api.endpoints import (
    health,
    auth,
    users,
    ct_mri,
    iot,
    questionnaire,
    genetics,
    blood,
    rehabilitation,
    encounters,
)

api_router = APIRouter()

# Health & Auth
api_router.include_router(health.router, prefix="/health", tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])

# AI Services
api_router.include_router(ct_mri.router, prefix="/services/ct-mri", tags=["S1: CT/MRI Analysis"])
api_router.include_router(iot.router, prefix="/services/iot", tags=["S2: IoT Monitoring"])
api_router.include_router(questionnaire.router, prefix="/services/questionnaire", tags=["S3: Questionnaire"])
api_router.include_router(genetics.router, prefix="/services/genetics", tags=["S4: Genetics"])
api_router.include_router(blood.router, prefix="/services/blood", tags=["S5: Blood Analysis"])
api_router.include_router(rehabilitation.router, prefix="/services/rehabilitation", tags=["S6: Rehabilitation"])
api_router.include_router(encounters.router, prefix="/encounters", tags=["Encounters"])

