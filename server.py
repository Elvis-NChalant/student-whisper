from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Union
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Updated models to handle both courses and companies
class CourseRequest(BaseModel):
    id: str
    name: str
    code: str
    instructor: str
    credits: int
    description: str
    prerequisites: List[str] = []

class CompanyRequest(BaseModel):
    id: str
    name: str
    industry: str
    location: str
    description: str
    tech_stack: List[str] = []

class RatingResponse(BaseModel):
    rating: float
    success: bool
    message: str

@app.post("/getRating")
async def get_rating(data: Union[CourseRequest, CompanyRequest]):
    """Returns 4.0 rating for any course or company"""
    return RatingResponse(
        rating=4.0,
        success=True,
        message="Rating retrieved successfully"
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=6969)
