"""
FastAPI backend for Madina Attend student attendance system
"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models.attendance import CheckInRequest, CheckInResponse
from services.sheets_service import SheetsService

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Madina Attend API",
    description="Student attendance system API",
    version="1.0.0",
)

# Configure CORS to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize sheets service
try:
    sheets_service = SheetsService()
except Exception as e:
    print(f"Warning: Failed to initialize SheetsService: {e}")
    sheets_service = None


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Madina Attend API",
        "status": "running",
        "sheets_service": "initialized" if sheets_service else "not initialized",
    }


@app.post("/checkin", response_model=CheckInResponse)
async def check_in(request: CheckInRequest):
    """
    Process student check-in or check-out request
    
    Logs the attendance action with the student's name
    """
    if not sheets_service:
        raise HTTPException(
            status_code=503,
            detail="Sheets service is not available. Please check configuration.",
        )
    
    # Validate name is not empty
    if not request.name or not request.name.strip():
        return CheckInResponse(
            success=False,
            message="Please enter your name.",
        )
    
    try:
        # Log the attendance action
        sheets_service.log_attendance(request.name.strip(), request.action)
        
        # Prepare success message
        action_text = "checked in" if request.action == "checkin" else "checked out"
        message = f"Successfully {action_text}."
        
        return CheckInResponse(
            success=True,
            message=message,
        )
        
    except ValueError as e:
        # Handle configuration or data errors
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing your request: {str(e)}",
        )
