from fastapi import HTTPException, Header, Depends
import jwt
try:
    from backend.config import JWT_SECRET, JWT_ALGORITHM
    from backend.services.user_service import get_user_service
except ImportError:
    from config import JWT_SECRET, JWT_ALGORITHM
    from services.user_service import get_user_service

async def get_current_user(authorization: str = Header(None), token: str = None):
    auth_token = None
    
    # Check if authorization is a string (actual header value) 
    # rather than the FastAPI Header object default
    if isinstance(authorization, str):
        # Expected format: "Bearer <token>"
        auth_token = authorization.split(" ")[1] if " " in authorization else authorization
    elif token:
        auth_token = token
        
    if not auth_token:
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    try:
        payload = jwt.decode(auth_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        identifier = payload.get("sub")
        
        user_service = get_user_service()
        user = user_service.get_user_by_email_or_username(identifier)
                    
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except (jwt.InvalidTokenError, IndexError):
        raise HTTPException(status_code=401, detail="Invalid token")
