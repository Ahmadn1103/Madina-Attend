"""
Pydantic models for attendance API requests and responses
"""
from typing import Literal
from pydantic import BaseModel


class CheckInRequest(BaseModel):
    """Request model for check-in/check-out operations"""
    name: str
    action: Literal["checkin", "checkout"]


class CheckInResponse(BaseModel):
    """Response model for check-in/check-out operations"""
    success: bool
    message: str
