from pydantic import BaseModel
from typing import Any, Dict, Optional, List

class FlareRequest(BaseModel):
    cmd: str
    url: Optional[str] = None
    maxTimeout: Optional[int] = 60000
    followRedirects: Optional[bool] = True
    userAgent: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    # passthrough for other fields
    class Config:
        extra = "allow"

class FlareResponse(BaseModel):
    status: str
    message: Optional[str] = None
    solution: Dict[str, Any]
