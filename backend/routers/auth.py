"""
VOXA Backend — Auth Router
Handles authentication: login, signup, and user profiles.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import jwt
try:
    from backend.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_HOURS
except ImportError:
    from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_HOURS
import logging

try:
    from backend.services.user_service import get_user_service
except ImportError:
    from services.user_service import get_user_service

router = APIRouter()
logger = logging.getLogger("voxa.router.auth")

class LoginRequest(BaseModel):
    email: str  # Can be email or username
    password: str

class SignupRequest(BaseModel):
    email: str
    username: str
    password: str
    name: str

from typing import Optional

class UserResponse(BaseModel):
    id: str
    name: str
    username: str
    email: str
    role: str = "user"
    profile_pic: Optional[str] = None

class AuthResponse(BaseModel):
    user: UserResponse
    access_token: str

def create_token(identifier: str):
    expiry = datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)
    payload = {"sub": identifier, "exp": expiry}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    user_service = get_user_service()
    user = user_service.get_user_by_email_or_username(request.email)
    
    if not user or user["password"] != request.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["email"])
    return {
        "user": {k: v for k, v in user.items() if k != "password"},
        "access_token": token
    }

@router.post("/signup", response_model=AuthResponse)
async def signup(request: SignupRequest):
    user_service = get_user_service()
    
    # Check if user already exists
    if user_service.get_user_by_email_or_username(request.email) or \
       user_service.get_user_by_email_or_username(request.username):
        raise HTTPException(status_code=400, detail="Email or username already registered")
    
    try:
        new_user = user_service.create_user(
            name=request.name,
            username=request.username,
            email=request.email,
            password=request.password
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    token = create_token(request.email)
    return {
        "user": new_user,
        "access_token": token
    }

try:
    from backend.dependencies import get_current_user
except ImportError:
    from dependencies import get_current_user

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Returns the current user data if the token is valid.
    """
    return {k: v for k, v in current_user.items() if k != "password"}

from fastapi import UploadFile, File
from pathlib import Path
try:
    from backend.services.storage_service import get_storage_service
except ImportError:
    from services.storage_service import get_storage_service

@router.post("/profile-pic")
async def upload_profile_pic(
    file: UploadFile = File(...), 
    current_user: dict = Depends(get_current_user)
):
    """
    Uploads a profile picture for the current user.
    """
    # Generate deterministic key so new upload replaces old avatar for user
    file_extension = Path(file.filename).suffix
    filename = f"user_{current_user['id']}{file_extension}"
    key = f"profile_pics/{filename}"
    content = await file.read()
    storage = get_storage_service()
    stored = storage.save_bytes(key=key, data=content, content_type=file.content_type)
        
    # Update DB
    user_id = current_user['id']
    profile_pic_url = stored.url
    user_service = get_user_service()
    user_service.update_profile_pic(user_id, profile_pic_url)
    
    return {"profile_pic": profile_pic_url}

@router.post("/reset-password")
async def reset_password(request: dict):
    username = request.get("username")
    old_password = request.get("old_password")
    new_password = request.get("new_password")
    
    if not username or not old_password or not new_password:
        raise HTTPException(status_code=400, detail="Missing required fields")
        
    user_service = get_user_service()
    user = user_service.get_user_by_email_or_username(username)
            
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
        
    if user["password"] != old_password:
        raise HTTPException(status_code=401, detail="Authentication failed: Incorrect old password")
        
    user_service.update_password(username, new_password)
    return {"message": "Neural key updated successfully"}
