from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import os
from datetime import datetime, timezone
import uvicorn

app = FastAPI(title="Campus Booking API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup
DB_PATH = os.path.join(os.path.dirname(__file__), 'bookings.db')

def init_database():
    """Initialize the database with tables and default data"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS venues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            capacity INTEGER DEFAULT 20,
            location TEXT DEFAULT ''
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venue_id INTEGER NOT NULL,
            booker_name TEXT NOT NULL,
            start_time DATETIME NOT NULL,
            end_time DATETIME NOT NULL,
            FOREIGN KEY (venue_id) REFERENCES venues (id)
        )
    ''')
    
    # Check if venues exist, if not add defaults
    cursor.execute("SELECT COUNT(*) FROM venues")
    if cursor.fetchone()[0] == 0:
        default_venues = [
            ("Lecture Hall A", "Room", 50, "Building 1, Floor 1"),
            ("Lecture Hall B", "Room", 75, "Building 1, Floor 2"),
            ("Main Library", "Library", 200, "Central Building"),
            ("Science Lab 1", "Lab", 30, "Science Building, Floor 1"),
            ("Auditorium", "Auditorium", 300, "Main Building"),
            ("Study Room 101", "Study Room", 10, "Library, Floor 2"),
            ("Computer Lab", "Lab", 25, "Tech Building, Floor 1"),
            ("Conference Room A", "Meeting Room", 20, "Admin Building, Floor 3")
        ]
        cursor.executemany(
            "INSERT INTO venues (name, type, capacity, location) VALUES (?, ?, ?, ?)", 
            default_venues
        )
    
    conn.commit()
    conn.close()

# Pydantic models
class VenueResponse(BaseModel):
    id: int
    name: str
    type: str
    capacity: int
    location: str

class BookingRequest(BaseModel):
    venue_id: int
    booker_name: str
    start_time: str
    end_time: str

class BookingResponse(BaseModel):
    id: int
    venue_id: int
    venue_name: str
    booker_name: str
    start_time: str
    end_time: str

class AvailabilityRequest(BaseModel):
    venue_id: int
    start_time: str
    end_time: str

# Helper functions
def get_db_connection():
    return sqlite3.connect(DB_PATH)

def is_available(venue_id: int, start_time: str, end_time: str) -> bool:
    """Check if a venue is available during the specified time"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM bookings 
        WHERE venue_id = ? 
        AND (start_time < ? AND end_time > ?)
    ''', (venue_id, end_time, start_time))
    
    result = cursor.fetchone()
    conn.close()
    return result is None

# API Routes
@app.on_event("startup")
async def startup():
    init_database()

@app.get("/venues", response_model=List[VenueResponse])
async def get_venues():
    """Get all available venues"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, name, type, capacity, location FROM venues ORDER BY name")
    venues = cursor.fetchall()
    conn.close()
    
    return [
        VenueResponse(
            id=venue[0],
            name=venue[1],
            type=venue[2],
            capacity=venue[3],
            location=venue[4]
        ) for venue in venues
    ]

@app.get("/bookings", response_model=List[BookingResponse])
async def get_bookings():
    """Get all bookings"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT b.id, b.venue_id, v.name, b.booker_name, b.start_time, b.end_time 
        FROM bookings b 
        JOIN venues v ON b.venue_id = v.id 
        ORDER BY b.start_time
    ''')
    bookings = cursor.fetchall()
    conn.close()
    
    return [
        BookingResponse(
            id=booking[0],
            venue_id=booking[1],
            venue_name=booking[2],
            booker_name=booking[3],
            start_time=booking[4],
            end_time=booking[5]
        ) for booking in bookings
    ]

@app.post("/bookings", response_model=BookingResponse)
async def create_booking(booking: BookingRequest):
    """Create a new booking"""
    # Validate datetime format
    try:
        start_dt = datetime.fromisoformat(booking.start_time.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(booking.end_time.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format")
    
    # Check if end time is after start time
    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    
    # Check availability
    if not is_available(booking.venue_id, booking.start_time, booking.end_time):
        raise HTTPException(status_code=409, detail="Venue is not available for the selected time")
    
    # Create booking
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "INSERT INTO bookings (venue_id, booker_name, start_time, end_time) VALUES (?, ?, ?, ?)",
            (booking.venue_id, booking.booker_name, booking.start_time, booking.end_time)
        )
        booking_id = cursor.lastrowid
        
        # Get venue name
        cursor.execute("SELECT name FROM venues WHERE id = ?", (booking.venue_id,))
        venue_name = cursor.fetchone()[0]
        
        conn.commit()
        conn.close()
        
        return BookingResponse(
            id=booking_id,
            venue_id=booking.venue_id,
            venue_name=venue_name,
            booker_name=booking.booker_name,
            start_time=booking.start_time,
            end_time=booking.end_time
        )
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/check-availability")
async def check_availability(request: AvailabilityRequest):
    """Check if a venue is available"""
    available = is_available(request.venue_id, request.start_time, request.end_time)
    return {"available": available}

@app.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: int):
    """Delete a booking"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Booking not found")
    
    conn.commit()
    conn.close()
    return {"message": "Booking deleted successfully"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
