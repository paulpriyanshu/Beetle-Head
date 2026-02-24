# Sync endpoint schemas and JWT verification
from typing import Optional, List
from pydantic import BaseModel
from fastapi import Depends, HTTPException, Header
from jose import JWTError, jwt
from sqlalchemy.orm import Session

# JWT constants
SECRET_KEY = "your-very-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

# JWT verification dependency
async def get_current_user(authorization: Optional[str] = Header(None)):
    """Extract and verify JWT from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Sync request schemas
class MessageSync(BaseModel):
    role: str
    content: str
    created_at: Optional[str] = None

class MessageCreate(BaseModel):
    user_query: str
    ai_response: str


class ConversationSync(BaseModel):
    title: Optional[str] = None
    messages: List[MessageSync]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class NoteSync(BaseModel):
    title: Optional[str] = None
    content: str
    note_type: str = "general"
    video_url: Optional[str] = None
    video_title: Optional[str] = None
    timestamp: Optional[str] = None
    thumbnail_url: Optional[str] = None
    created_at: Optional[str] = None

class ManifestSync(BaseModel):
    query: str
    manifest_data: dict
    created_at: Optional[str] = None
