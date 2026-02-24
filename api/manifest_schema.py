from typing import List, Optional, Any, Dict, Union
from enum import Enum
from pydantic import BaseModel, Field

class StepType(str, Enum):
    SCRAPE_SEARCH_RESULTS = "SCRAPE_SEARCH_RESULTS"
    AI_VALIDATE_RESULTS = "AI_VALIDATE_RESULTS"
    OPEN_VALIDATED_URLS = "OPEN_VALIDATED_URLS"
    OPEN_YOUTUBE_TAB = "OPEN_YOUTUBE_TAB"
    ANALYZE_PAGE = "ANALYZE_PAGE"
    SCRAPE_YOUTUBE_RESULTS = "SCRAPE_YOUTUBE_RESULTS"
    NAVIGATE_TO = "NAVIGATE_TO"

class ErrorHandling(BaseModel):
    onStepFailure: str = Field(default="CONTINUE_WITH_WARNING", description="Action to take on failure")

class ValidationCriteria(BaseModel):
    mustContain: List[str] = Field(default_factory=list)
    preferTags: List[str] = Field(default_factory=list)

class ValidationConfig(BaseModel):
    validationPrompt: str
    criteria: ValidationCriteria
    minConfidenceScore: float = 0.55
    maxResults: int = 5

class StepConfig(BaseModel):
    # Search configs
    batchSize: Optional[int] = None
    searchQuery: Optional[str] = None
    
    # Navigation configs
    url: Optional[str] = None
    
    # Validation configs
    validationPrompt: Optional[str] = None
    criteria: Optional[ValidationCriteria] = None
    minConfidenceScore: Optional[float] = None
    maxResults: Optional[int] = None
    
    # Opening tabs configs
    maxTabs: Optional[int] = None
    staggerDelay: Optional[int] = None
    activateFirst: Optional[bool] = None
    
    # Analysis configs
    waitForPageLoad: Optional[int] = None
    extractContent: Optional[bool] = None
    extractLinks: Optional[bool] = None
    extractStructuredData: Optional[bool] = None
    keywords: Optional[List[str]] = None
    
    # Youtube configs
    youtubeQuery: Optional[str] = None
    waitForLoad: Optional[int] = None
    maxVideos: Optional[int] = None

class ManifestStep(BaseModel):
    id: str
    type: StepType
    dependencies: List[str] = Field(default_factory=list)
    parallel: bool = False
    config: StepConfig = Field(default_factory=StepConfig)

class Manifest(BaseModel):
    manifestId: str
    query: str
    youtubeQuery: Optional[str] = None
    errorHandling: ErrorHandling = Field(default_factory=ErrorHandling)
    steps: List[ManifestStep]
