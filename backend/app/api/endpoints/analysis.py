"""
Audio Analysis WebSocket Endpoint
Handles audio transcription with speaker diarization and SOAP format generation.
"""

import os
import json
import tempfile
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import httpx

router = APIRouter()

# Groq API configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"


async def transcribe_audio(audio_data: bytes, language: str = "auto") -> dict:
    """
    Transcribe audio using Groq Whisper API.
    
    Args:
        audio_data: Raw audio bytes
        language: Language code ("kk" for Kazakh, "ru" for Russian, "auto" for auto-detection)
    
    Returns:
        dict with transcription text
    """
    if not GROQ_API_KEY:
        return {"error": "GROQ_API_KEY not configured", "text": ""}
    
    # Save audio to temp file
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(audio_data)
        temp_path = f.name
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            with open(temp_path, "rb") as audio_file:
                files = {"file": ("audio.webm", audio_file, "audio/webm")}
                data = {
                    "model": "whisper-large-v3",
                    "response_format": "verbose_json",  # Get word-level timestamps
                }
                
                # Only set language if not auto-detect
                if language != "auto":
                    data["language"] = language
                
                response = await client.post(
                    GROQ_WHISPER_URL,
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                    files=files,
                    data=data,
                )
            
            if response.status_code != 200:
                error_text = response.text
                print(f"Whisper API error: {error_text}")
                return {"error": f"Transcription failed: {error_text}", "text": ""}
            
            result = response.json()
            return {
                "text": result.get("text", ""),
                "language": result.get("language", language),
                "segments": result.get("segments", []),
            }
    finally:
        # Cleanup temp file
        try:
            os.unlink(temp_path)
        except:
            pass


async def generate_soap_analysis(transcript: str, language: str = "ru") -> dict:
    """
    Generate SOAP format analysis from transcript using Groq LLM.
    
    Args:
        transcript: Transcribed text
        language: Language of the transcript
    
    Returns:
        dict with SOAP format fields
    """
    if not GROQ_API_KEY:
        return {"error": "GROQ_API_KEY not configured"}
    
    if not transcript or len(transcript) < 20:
        return {"error": "Transcript too short for analysis"}
    
    # System prompt for SOAP analysis
    system_prompt = """You are a medical documentation assistant. Analyze the doctor-patient conversation and generate a structured medical note in SOAP format.

Identify speakers as SPEAKER_0, SPEAKER_1, etc. Try to determine who is the doctor and who is the patient based on context.

Return a JSON object with these fields:
{
    "subjective": "Patient's reported symptoms, complaints, and history",
    "objective": "Observable findings, vital signs mentioned, physical examination notes",
    "assessment": "Primary diagnosis or clinical impression based on the conversation",
    "differentialDiagnosis": "Alternative diagnoses if mentioned or implied",
    "plan": "Treatment plan, medications, recommendations, follow-up instructions",
    "generalCondition": "Overall patient condition summary",
    "dialogueProtocol": "Full dialogue with speaker labels (SPEAKER_0: text, SPEAKER_1: text)",
    "recommendations": "Summary of all recommendations given",
    "conclusion": "Brief conclusion statement"
}

Be thorough and accurate. Extract all relevant medical information from the conversation.
If information for a field is not available, leave it empty but include the field.
Respond ONLY with the JSON object, no additional text."""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                GROQ_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Analyze this medical consultation transcript:\n\n{transcript}"}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 4000,
                },
            )
            
            if response.status_code != 200:
                error_text = response.text
                print(f"LLM API error: {error_text}")
                return {"error": f"Analysis failed: {error_text}"}
            
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Parse JSON from response
            try:
                # Handle potential markdown code blocks
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]
                
                analysis = json.loads(content.strip())
                return analysis
            except json.JSONDecodeError as e:
                print(f"Failed to parse LLM response as JSON: {e}")
                print(f"Raw content: {content}")
                # Return raw content as dialogue if parsing fails
                return {
                    "dialogueProtocol": transcript,
                    "generalCondition": "",
                    "recommendations": "",
                    "conclusion": "Анализ завершен, но структурирование данных не удалось.",
                    "subjective": "",
                    "objective": "",
                    "assessment": "",
                    "plan": "",
                }
                
    except Exception as e:
        print(f"LLM analysis error: {e}")
        return {"error": str(e)}


@router.websocket("/analyze")
async def websocket_audio_analyze(websocket: WebSocket):
    """
    WebSocket endpoint for real-time audio analysis.
    
    Flow:
    1. Client connects
    2. Client sends audio blob (binary)
    3. Server transcribes audio
    4. Server generates SOAP analysis
    5. Server sends result back
    """
    await websocket.accept()
    print("WebSocket connection accepted for audio analysis")
    
    try:
        # Receive audio data (binary)
        audio_data = await websocket.receive_bytes()
        print(f"Received audio data: {len(audio_data)} bytes")
        
        if len(audio_data) < 1000:
            await websocket.send_json({
                "status": "error",
                "message": "Audio data too small. Please record a longer conversation."
            })
            return
        
        # Step 1: Transcribe audio (auto-detect language)
        print("Starting transcription...")
        transcription = await transcribe_audio(audio_data, language="auto")
        
        if "error" in transcription and not transcription.get("text"):
            await websocket.send_json({
                "status": "error",
                "message": transcription.get("error", "Transcription failed")
            })
            return
        
        transcript_text = transcription.get("text", "")
        detected_language = transcription.get("language", "unknown")
        print(f"Transcription complete. Language: {detected_language}, Length: {len(transcript_text)}")
        
        if len(transcript_text) < 20:
            await websocket.send_json({
                "status": "error",
                "message": "Не удалось распознать речь. Убедитесь в качестве записи."
            })
            return
        
        # Step 2: Generate SOAP analysis
        print("Generating SOAP analysis...")
        analysis = await generate_soap_analysis(transcript_text, detected_language)
        
        if "error" in analysis and not any([
            analysis.get("subjective"),
            analysis.get("objective"),
            analysis.get("assessment"),
            analysis.get("plan"),
            analysis.get("dialogueProtocol"),
        ]):
            await websocket.send_json({
                "status": "error",
                "message": analysis.get("error", "Analysis failed")
            })
            return
        
        # Ensure dialogueProtocol has the transcript
        if not analysis.get("dialogueProtocol"):
            analysis["dialogueProtocol"] = transcript_text
        
        print("Analysis complete. Sending result...")
        
        # Send successful result
        await websocket.send_json({
            "status": "completed",
            "result": analysis,
            "language": detected_language,
        })
        
    except WebSocketDisconnect:
        print("Client disconnected from audio analysis WebSocket")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.send_json({
                "status": "error",
                "message": f"Server error: {str(e)}"
            })
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass

