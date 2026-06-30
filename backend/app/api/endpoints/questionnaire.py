"""
S3: Questionnaire Service
=========================
AI analysis of questionnaires for stress level 
and neurodegenerative disease risk assessment.

Based on: Omirai questionnaires
Team: Mukhammedzhan
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime

from app.core.auth import (
    CurrentUserContext,
    get_current_user_context,
    require_patient_access_if_present,
)

router = APIRouter(dependencies=[Depends(get_current_user_context)])


class Question(BaseModel):
    id: str
    text: str
    type: str  # "scale", "multiple_choice", "text"
    options: Optional[List[str]] = None
    scale_min: Optional[int] = None
    scale_max: Optional[int] = None


class Questionnaire(BaseModel):
    id: str
    title: str
    description: str
    category: str  # "stress", "cognitive", "mood", "sleep"
    estimated_time_minutes: int
    questions: List[Question]


class Answer(BaseModel):
    question_id: str
    value: str | int | float


class SubmissionRequest(BaseModel):
    questionnaire_id: str
    answers: List[Answer]
    patient_id: str | None = None


class AnalysisResult(BaseModel):
    id: str
    questionnaire_id: str
    submitted_at: datetime
    scores: dict
    risk_level: str
    insights: List[str]
    recommendations: List[str]


@router.get("/list", response_model=List[Questionnaire])
async def get_available_questionnaires():
    """Get list of available questionnaires"""
    return [
        Questionnaire(
            id="stress_pss10",
            title="Perceived Stress Scale (PSS-10)",
            description="Оценка уровня воспринимаемого стресса за последний месяц",
            category="stress",
            estimated_time_minutes=5,
            questions=[
                Question(
                    id="q1",
                    text="Как часто за последний месяц вы чувствовали, что не можете контролировать важные вещи в своей жизни?",
                    type="scale",
                    scale_min=0,
                    scale_max=4,
                ),
            ],
        ),
        Questionnaire(
            id="cognitive_mmse",
            title="Mini-Mental State Examination (MMSE)",
            description="Краткая шкала оценки психического статуса",
            category="cognitive",
            estimated_time_minutes=10,
            questions=[],
        ),
        Questionnaire(
            id="sleep_psqi",
            title="Pittsburgh Sleep Quality Index",
            description="Оценка качества сна за последний месяц",
            category="sleep",
            estimated_time_minutes=7,
            questions=[],
        ),
    ]


@router.get("/{questionnaire_id}", response_model=Questionnaire)
async def get_questionnaire(questionnaire_id: str):
    """Get specific questionnaire with all questions"""
    # TODO: Implement with database
    if questionnaire_id == "stress_pss10":
        return Questionnaire(
            id="stress_pss10",
            title="Perceived Stress Scale (PSS-10)",
            description="Оценка уровня воспринимаемого стресса",
            category="stress",
            estimated_time_minutes=5,
            questions=[
                Question(
                    id="q1",
                    text="Как часто за последний месяц вы чувствовали, что не можете контролировать важные вещи в своей жизни?",
                    type="scale",
                    scale_min=0,
                    scale_max=4,
                ),
                Question(
                    id="q2",
                    text="Как часто за последний месяц вы чувствовали уверенность в своей способности справляться с личными проблемами?",
                    type="scale",
                    scale_min=0,
                    scale_max=4,
                ),
                Question(
                    id="q3",
                    text="Как часто за последний месяц вы чувствовали, что всё идет так, как вы хотите?",
                    type="scale",
                    scale_min=0,
                    scale_max=4,
                ),
            ],
        )
    raise HTTPException(status_code=404, detail="Questionnaire not found")


@router.post("/submit", response_model=AnalysisResult)
async def submit_questionnaire(
    submission: SubmissionRequest,
    current_user: CurrentUserContext = Depends(get_current_user_context),
):
    """
    Submit completed questionnaire for AI analysis.
    Returns risk assessment and personalized recommendations.
    """
    require_patient_access_if_present(submission.patient_id, current_user)

    # TODO: Implement actual AI analysis
    return AnalysisResult(
        id="result_001",
        questionnaire_id=submission.questionnaire_id,
        submitted_at=datetime.now(),
        scores={
            "total_score": 15,
            "stress_category": "moderate",
            "percentile": 45,
        },
        risk_level="moderate",
        insights=[
            "Ваш уровень стресса находится в умеренном диапазоне",
            "Выявлены потенциальные триггеры: рабочая нагрузка",
        ],
        recommendations=[
            "Практикуйте техники релаксации (дыхательные упражнения, медитация)",
            "Соблюдайте режим сна не менее 7-8 часов",
            "Рекомендуется консультация с психологом",
        ],
    )


@router.get("/history", response_model=List[AnalysisResult])
async def get_questionnaire_history():
    """Get history of completed questionnaires"""
    # TODO: Implement with database
    return []


@router.get("/result/{result_id}", response_model=AnalysisResult)
async def get_result(result_id: str):
    """Get specific questionnaire result"""
    raise HTTPException(status_code=404, detail="Result not found")

