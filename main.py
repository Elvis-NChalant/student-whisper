from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Union, Optional
import uvicorn
import google.generativeai as genai
import pdfplumber
import docx
import io
import json
import pytesseract
from PIL import Image
from pdf2image import convert_from_bytes
import os
from dotenv import load_dotenv
import re

# Load environment variables from .env file
load_dotenv()

# Configure Tesseract path (adjust if necessary)
if os.name == 'nt':  # Windows
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Load Gemini API key from environment variable
try:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Warning: GEMINI_API_KEY environment variable not set. Resume analysis will not work.")
    else:
        genai.configure(api_key=api_key)
except Exception as e:
    print(f"Error configuring Gemini API: {e}")

# Initialize FastAPI app
app = FastAPI(
    title="Course Rating & Resume Analysis Service",
    description="AI-powered microservice for course/company ratings based on resume compatibility",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React development server
        "http://localhost:5173",  # Vite development server
        "http://localhost:8080",  # Alternative development server
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*"  # Allow all origins for development (remove in production)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable to store resume text for rating calculations
current_resume_text = ""

# Pydantic Models
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
    compatibility_score: Optional[float] = None
    match_details: Optional[str] = None

class CompanySuggestion(BaseModel):
    company: str
    role: str
    reason: str
    how_to_reach: str
    probability_score: int
    confidence_level: str

class ResumeAnalysisResponse(BaseModel):
    success: bool
    suggestions: List[CompanySuggestion]
    error: Optional[str] = None
    resume_processed: bool = False

class ResumeUploadResponse(BaseModel):
    success: bool
    message: str
    resume_summary: Optional[str] = None
    key_skills: Optional[List[str]] = None
    experience_years: Optional[int] = None

# Mock course data for resume analysis
COURSE_DATA = [
    {"name": "Introduction to Data Science", "skills_gained": "Data Analysis, Machine Learning, Python", "field": "Technology"},
    {"name": "Digital Marketing Fundamentals", "skills_gained": "SEO, SEM, Social Media Marketing", "field": "Marketing"},
    {"name": "Financial Modeling and Valuation", "skills_gained": "Financial Analysis, Valuation, Excel", "field": "Finance"},
    {"name": "Web Development Bootcamp", "skills_gained": "HTML, CSS, JavaScript, React", "field": "Technology"},
    {"name": "Advanced Python for AI", "skills_gained": "Machine Learning, Deep Learning, NLP", "field": "Technology"}
]

# Helper Functions
def extract_text_from_file(file_content: bytes, filename: str) -> tuple[str, Optional[str]]:
    """Extracts text from a PDF or DOCX file using both direct parsing and OCR fallback."""
    file_extension = filename.split('.')[-1].lower()
    text = ""
    
    try:
        if file_extension == "pdf":
            with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                for page in pdf.pages:
                    extracted = page.extract_text()
                    text += extracted if extracted else ""
            
            # Fallback to OCR if no text is extracted
            if not text.strip():
                images = convert_from_bytes(file_content)
                for image in images:
                    text += pytesseract.image_to_string(image) + "\n"
                
        elif file_extension == "docx":
            doc = docx.Document(io.BytesIO(file_content))
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            return "", "Unsupported file format. Please upload a PDF or DOCX file."
        
        if not text.strip():
            return "", "Failed to extract any text from the document. Please check the file's content or format."
        
        print("Extracted resume text:", text[:500] + "..." if len(text) > 500 else text)
        return text, None
    
    except Exception as e:
        return "", f"Error processing file: {str(e)}"

def clean_json_response(response_text: str) -> Optional[str]:
    """Cleans the Gemini API response to extract valid JSON."""
    if not response_text or len(response_text) == 0:
        return None
        
    try:
        # Remove markdown code block indicators and extra whitespace
        cleaned_text = re.sub(r'``````$', '', response_text, flags=re.MULTILINE)
        cleaned_text = cleaned_text.strip()
        
        # Ensure only the JSON content is returned
        json_start = cleaned_text.find('{')
        json_end = cleaned_text.rfind('}') + 1
        
        if json_start != -1 and json_end > json_start:
            cleaned_text = cleaned_text[json_start:json_end]
            return cleaned_text
            
        # Try array format as fallback
        json_start = cleaned_text.find('[')
        json_end = cleaned_text.rfind(']') + 1
        
        if json_start != -1 and json_end > json_start:
            cleaned_text = cleaned_text[json_start:json_end]
            return cleaned_text
            
        return None
        
    except Exception as e:
        print(f"Error cleaning JSON response: {e}")
        return None

def get_ai_rating_with_resume(resume_text: str, entity_data: dict, entity_type: str) -> tuple[float, str]:
    """Uses AI to rate course/company compatibility with resume"""
    if not api_key or not resume_text.strip():
        return 4.0, "Default rating - no resume or API key available"
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Safely build entity info string
        if entity_type == "course":
            entity_info = f"""
            Course: {entity_data.get('name', 'Unknown')}
            Description: {entity_data.get('description', 'No description')}
            Prerequisites: {', '.join(entity_data.get('prerequisites', []))}
            Credits: {entity_data.get('credits', 'Unknown')}
            Instructor: {entity_data.get('instructor', 'Unknown')}
            """
        else:  # company
            entity_info = f"""
            Company: {entity_data.get('name', 'Unknown')}
            Industry: {entity_data.get('industry', 'Unknown')}
            Location: {entity_data.get('location', 'Unknown')}
            Description: {entity_data.get('description', 'No description')}
            Tech Stack: {', '.join(entity_data.get('tech_stack', []))}
            """

        prompt = f"""
        Analyze compatibility between this resume and {entity_type} information.
        
        Resume (first 1000 chars):
        {resume_text[:1000]}
        
        {entity_type.title()} Information:
        {entity_info}
        
        Provide a rating from 0.0 to 5.0 and brief explanation.
        
        Respond with ONLY this JSON format:
        {{"rating": 4.2, "explanation": "Brief explanation here"}}
        """
        
        response = model.generate_content(prompt)
        
        if not response or not response.text:
            return 3.0, "No response from AI model"
            
        response_text = response.text.strip()
        
        # More robust JSON parsing
        try:
            # Try to extract JSON from response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start == -1 or json_end <= json_start:
                return 3.0, "Unable to parse AI response format"
                
            json_str = response_text[json_start:json_end]
            result = json.loads(json_str)
            
            rating = float(result.get('rating', 3.0))
            explanation = str(result.get('explanation', 'AI analysis completed'))
            
            # Ensure rating is within bounds
            rating = max(0.0, min(5.0, rating))
            return rating, explanation
            
        except (json.JSONDecodeError, ValueError) as e:
            print(f"JSON parsing error: {e}")
            print(f"Raw response: {response_text}")
            return 3.0, "Error parsing AI response"
            
    except Exception as e:
        print(f"Error in AI rating: {e}")
        return 3.0, f"Error in AI analysis: {str(e)}"

def get_ai_suggestions(resume_text: str, course_data_str: str) -> List[dict]:
    """Uses the Gemini API to generate company suggestions"""
    if not api_key:
        return [{"company": "N/A", "role": "N/A", "reason": "Gemini API key not configured", "how_to_reach": "N/A", "probability_score": 0, "confidence_level": "Low"}]
    
    model = genai.GenerativeModel('gemini-1.5-flash')

    prompt = f"""
    You are an AI career advisor. Analyze the following resume content and suggest 3 to 5 relevant companies or job roles the user could apply for. For each suggestion, provide:
    - A brief reason why they would be a good fit.
    - How to reach the company (e.g., website or job board).
    - A probability_score (0-100%) estimating the likelihood of being a strong candidate.
    - A confidence_level ('Low', 'Medium', 'High') indicating your certainty.

    Return the response strictly as a JSON array of objects, each with keys: "company", "role", "reason", "how_to_reach", "probability_score", and "confidence_level".

    Resume content:
    {resume_text}

    Example response format:
    [
        {{
            "company": "Example Corp",
            "role": "Data Scientist",
            "reason": "Your skills in Python align with their needs.",
            "how_to_reach": "Apply at example.com/careers",
            "probability_score": 85,
            "confidence_level": "High"
        }}
    ]
    """
    
    try:
        response = model.generate_content(prompt)
        cleaned_response = clean_json_response(response.text)
        if not cleaned_response:
            raise ValueError("Failed to extract valid JSON from response")
        suggestions = json.loads(cleaned_response)
        return suggestions
    except Exception as e:
        print(f"Failed to get AI suggestions: {e}")
        return [{"company": "N/A", "role": "N/A", "reason": f"AI processing error: {str(e)}", "how_to_reach": "N/A", "probability_score": 0, "confidence_level": "Low"}]

# API Routes
@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "message": "AI-Powered Course Rating & Resume Analysis Service",
        "version": "2.0.0",
        "features": [
            "Resume-based course compatibility rating",
            "Resume-based company compatibility rating", 
            "AI-powered job suggestions",
            "Smart career recommendations"
        ],
        "endpoints": {
            "upload_resume_for_rating": "/upload_resume_for_rating (POST)",
            "get_rating": "/getRating (POST)", 
            "upload_resume": "/upload_resume (POST)",
            "health": "/health (GET)",
            "docs": "/docs"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ai-course-rating-resume-service",
        "version": "2.0.0",
        "gemini_configured": bool(api_key),
        "resume_loaded": bool(current_resume_text.strip())
    }

@app.post("/upload_resume_for_rating", response_model=ResumeUploadResponse)
async def upload_resume_for_rating(resume: UploadFile = File(...)):
    """Upload resume specifically for rating calculations"""
    global current_resume_text
    
    try:
        if not resume.filename:
            raise HTTPException(status_code=400, detail="No file selected")
        
        file_extension = resume.filename.split('.')[-1].lower()
        if file_extension not in ['pdf', 'docx']:
            raise HTTPException(
                status_code=400, 
                detail="Unsupported file format. Please upload a PDF or DOCX file."
            )
        
        # Read file content
        file_content = await resume.read()
        
        # Extract text from file
        resume_text, error = extract_text_from_file(file_content, resume.filename)
        if error:
            raise HTTPException(status_code=400, detail=error)
        
        # Store resume text globally for rating calculations
        current_resume_text = resume_text
        
        # Optional: Extract key information using AI
        summary = "Resume successfully processed and ready for compatibility analysis"
        key_skills = []
        experience_years = 0
        
        if api_key:
            try:
                model = genai.GenerativeModel('gemini-1.5-flash')
                analysis_prompt = f"""
                Analyze this resume and extract:
                1. A brief professional summary (2-3 sentences)
                2. Top 5-8 key skills
                3. Estimated years of experience (integer)
                
                Resume:
                {resume_text}
                
                Return JSON format:
                {{
                    "summary": "brief summary",
                    "key_skills": ["skill1", "skill2", ...],
                    "experience_years": 5
                }}
                """
                
                response = model.generate_content(analysis_prompt)
                json_start = response.text.find('{')
                json_end = response.text.rfind('}') + 1
                
                if json_start != -1 and json_end != -1:
                    analysis = json.loads(response.text[json_start:json_end])
                    summary = analysis.get('summary', summary)
                    key_skills = analysis.get('key_skills', [])
                    experience_years = int(analysis.get('experience_years', 0))
                    
            except Exception as e:
                print(f"Error in resume analysis: {e}")
        
        return ResumeUploadResponse(
            success=True,
            message="Resume uploaded and processed successfully. You can now get personalized ratings!",
            resume_summary=summary,
            key_skills=key_skills,
            experience_years=experience_years
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in upload_resume_for_rating: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/getRating", response_model=RatingResponse)
async def get_rating(data: Union[CourseRequest, CompanyRequest]):
    """Returns AI-powered rating based on resume compatibility"""
    try:
        entity_name = getattr(data, 'name', 'Unknown')
        entity_type = "course" if isinstance(data, CourseRequest) else "company"
        
        print(f"Rating request for {entity_type}: {entity_name}")
        
        # Validate input data
        if not entity_name or entity_name == 'Unknown':
            return RatingResponse(
                rating=3.0,
                success=False,
                message="Invalid entity data provided",
                compatibility_score=None,
                match_details="Missing or invalid entity information"
            )
        
        # If no resume is uploaded, return default rating
        if not current_resume_text.strip():
            return RatingResponse(
                rating=4.0,
                success=True,
                message="Default rating provided. Upload your resume for personalized ratings!",
                compatibility_score=None,
                match_details="No resume available for analysis"
            )
        
        # Convert Pydantic model to dict for AI analysis
        try:
            entity_data = data.dict()
        except Exception as e:
            print(f"Error converting data to dict: {e}")
            return RatingResponse(
                rating=3.0,
                success=False,
                message="Error processing entity data",
                compatibility_score=None,
                match_details="Data conversion error"
            )
        
        # Get AI-powered rating based on resume
        ai_rating, explanation = get_ai_rating_with_resume(
            current_resume_text, 
            entity_data, 
            entity_type
        )
        
        return RatingResponse(
            rating=ai_rating,
            success=True,
            message="AI-powered compatibility rating generated successfully",
            compatibility_score=ai_rating,
            match_details=explanation
        )
        
    except Exception as e:
        print(f"Unexpected error in get_rating: {e}")
        return RatingResponse(
            rating=3.0,
            success=False,
            message=f"Internal server error: {str(e)}",
            compatibility_score=None,
            match_details="Server error occurred"
        )

@app.post("/upload_resume", response_model=ResumeAnalysisResponse)
async def upload_resume(resume: UploadFile = File(...)):
    """Upload and analyze resume for job suggestions"""
    try:
        if not resume.filename:
            raise HTTPException(status_code=400, detail="No file selected")
        
        file_extension = resume.filename.split('.')[-1].lower()
        if file_extension not in ['pdf', 'docx']:
            raise HTTPException(
                status_code=400, 
                detail="Unsupported file format. Please upload a PDF or DOCX file."
            )
        
        # Read file content
        file_content = await resume.read()
        
        # Extract text from file
        resume_text, error = extract_text_from_file(file_content, resume.filename)
        if error:
            return ResumeAnalysisResponse(
                success=False,
                suggestions=[],
                error=error
            )
        
        # Prepare course data
        course_data_str = "\n".join([
            f"Course: {c['name']}, Skills: {c['skills_gained']}, Field: {c['field']}"
            for c in COURSE_DATA
        ])
        
        # Get AI suggestions
        suggestions = get_ai_suggestions(resume_text, course_data_str)
        
        # Convert to Pydantic models
        suggestion_models = []
        for suggestion in suggestions:
            try:
                suggestion_models.append(CompanySuggestion(**suggestion))
            except Exception as e:
                print(f"Error converting suggestion to model: {e}")
                suggestion_models.append(CompanySuggestion(
                    company="Error",
                    role="Error", 
                    reason=f"Failed to parse suggestion: {str(e)}",
                    how_to_reach="N/A",
                    probability_score=0,
                    confidence_level="Low"
                ))
        
        return ResumeAnalysisResponse(
            success=True,
            suggestions=suggestion_models,
            resume_processed=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in upload_resume: {e}")
        return ResumeAnalysisResponse(
            success=False,
            suggestions=[],
            error=f"Internal server error: {str(e)}"
        )

@app.delete("/clear_resume")
async def clear_resume():
    """Clear stored resume data"""
    global current_resume_text
    current_resume_text = ""
    return {"message": "Resume data cleared successfully"}

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return {"error": "Endpoint not found"}, 404

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return {"error": "Internal server error"}, 500

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=6969,
        reload=True,
        log_level="info"
    )
