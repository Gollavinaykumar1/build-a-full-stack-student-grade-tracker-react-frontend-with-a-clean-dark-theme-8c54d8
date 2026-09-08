# main.py
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from sqlalchemy import create_engine, Column, Integer, String, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship, Session
from sqlalchemy.ext.declarative import declarative_base

# CRITICAL RULE: DO NOT generate database.py. Assume it already exists.
# Import Base, engine, and get_db from database.py
from database import Base, engine, get_db

# --- FastAPI App Setup ---
app = FastAPI(
    title="Student Grade Tracker API",
    description="API for managing student grades and user authentication.",
    version="1.0.0"
)

# CRITICAL CORS RULE: Always add CORSMiddleware with allow_origins=["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allows all headers
)

# CRITICAL ROOT ROUTE RULE: main.py MUST always include a root GET "/" route
@app.get("/")
def root():
    """
    Root endpoint for the API.
    Returns the status and a link to the API documentation.
    """
    return {"status": "running", "docs": "/docs", "message": "Welcome to the Student Grade Tracker API!"}

# CRITICAL HEALTH ROUTE RULE: main.py MUST always include a GET "/health" route
@app.get("/health")
def health():
    """
    Health check endpoint.
    Returns "healthy" if the application is running.
    """
    return {"status": "healthy"}

# --- Database Initialization ---
# This creates all tables defined by Base.metadata if they don't already exist.
# It should be called after the Base and engine are available.
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


# --- Security Configuration ---
# You should change this to a strong, randomly generated string in a production environment.
# For simplicity, it's hardcoded here, but ideally should come from an environment variable.
SECRET_KEY = "super-secret-key-you-should-change-this" # TODO: Change this in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login") # Pointing to our login endpoint

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- SQLAlchemy Models ---
# When defining SQLAlchemy models in Python, DO NOT use Pydantic types (like EmailStr)
# inside Column(). You MUST use SQLAlchemy types (like String, Integer).
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    # Define a relationship with StudentGrade
    grades = relationship("StudentGrade", back_populates="owner")

class StudentGrade(Base):
    __tablename__ = "student_grades"

    id = Column(Integer, primary_key=True, index=True)
    student_name = Column(String, index=True, nullable=False)
    subject = Column(String, nullable=False)
    grade = Column(Integer, nullable=False) # Assuming grade is an integer, e.g., 0-100

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="grades")

# --- Pydantic Schemas ---
# For request and response data validation/serialization

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# User Schemas
class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

# CRITICAL AUTH RULE: Accept JSON via standard Pydantic models for login/register
class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    class Config:
        orm_mode = True # Enable ORM mode for automatic mapping from SQLAlchemy model

# Student Grade Schemas
class StudentGradeBase(BaseModel):
    student_name: str
    subject: str
    grade: int # Use int as defined in SQLAlchemy model

class StudentGradeCreate(StudentGradeBase):
    pass # No extra fields for creation currently

class StudentGradeUpdate(StudentGradeBase):
    # Allow partial updates by making fields optional for PUT/PATCH, but here we assume full update
    student_name: Optional[str] = None
    subject: Optional[str] = None
    grade: Optional[int] = None

class StudentGradeResponse(StudentGradeBase):
    id: int
    owner_id: int
    class Config:
        orm_mode = True

# --- Authentication Dependency ---
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    return user

# --- API Routers ---
# Using APIRouter for better organization and prefixing
from fastapi import APIRouter

auth_router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Auth"]
)

users_router = APIRouter(
    prefix="/api/v1/users",
    tags=["Users"]
)

grades_router = APIRouter(
    prefix="/api/v1/grades",
    tags=["Student Grades"]
)

# --- Auth Endpoints ---
@auth_router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new user.
    Takes user email and password, hashes the password, and stores the user in the database.
    """
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    db_user = User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@auth_router.post("/login", response_model=Token)
def login_for_access_token(user_login: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticates a user and returns an access token.
    CRITICAL AUTH RULE: Accepts JSON body for login.
    """
    user = db.query(User).filter(User.email == user_login.email).first()
    if not user or not verify_password(user_login.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# --- Users Endpoints ---
@users_router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Retrieves the current authenticated user's details.
    Requires a valid JWT token.
    """
    return current_user

# --- Student Grades Endpoints ---
@grades_router.post("/", response_model=StudentGradeResponse, status_code=status.HTTP_201_CREATED)
def create_student_grade(
    grade: StudentGradeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Adds a new student grade for the current authenticated user.
    Requires a valid JWT token.
    """
    db_grade = StudentGrade(**grade.dict(), owner_id=current_user.id)
    db.add(db_grade)
    db.commit()
    db.refresh(db_grade)
    return db_grade

@grades_router.get("/", response_model=List[StudentGradeResponse])
def read_student_grades(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves all student grades belonging to the current authenticated user.
    Requires a valid JWT token.
    """
    grades = db.query(StudentGrade).filter(StudentGrade.owner_id == current_user.id).offset(skip).limit(limit).all()
    return grades

@grades_router.get("/{grade_id}", response_model=StudentGradeResponse)
def read_student_grade(
    grade_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves a specific student grade by ID, ensuring it belongs to the current user.
    Requires a valid JWT token.
    """
    db_grade = db.query(StudentGrade).filter(
        StudentGrade.id == grade_id,
        StudentGrade.owner_id == current_user.id
    ).first()
    if db_grade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student grade not found or not owned by user")
    return db_grade

@grades_router.put("/{grade_id}", response_model=StudentGradeResponse)
def update_student_grade(
    grade_id: int,
    grade_update: StudentGradeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates an existing student grade by ID, ensuring it belongs to the current user.
    Requires a valid JWT token.
    """
    db_grade = db.query(StudentGrade).filter(
        StudentGrade.id == grade_id,
        StudentGrade.owner_id == current_user.id
    ).first()
    if db_grade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student grade not found or not owned by user")
    
    # Update fields from the Pydantic model
    update_data = grade_update.dict(exclude_unset=True) # exclude_unset allows partial updates
    for key, value in update_data.items():
        setattr(db_grade, key, value)
    
    db.add(db_grade)
    db.commit()
    db.refresh(db_grade)
    return db_grade

@grades_router.delete("/{grade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student_grade(
    grade_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes a specific student grade by ID, ensuring it belongs to the current user.
    Requires a valid JWT token.
    """
    db_grade = db.query(StudentGrade).filter(
        StudentGrade.id == grade_id,
        StudentGrade.owner_id == current_user.id
    ).first()
    if db_grade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student grade not found or not owned by user")
    
    db.delete(db_grade)
    db.commit()
    return # Return no content for 204

# --- Register Routers with the main app ---
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(grades_router)

# Example `database.py` content (for user's reference, not part of the output):
#
# # database.py
# from sqlalchemy import create_engine
# from sqlalchemy.ext.declarative import declarative_base
# from sqlalchemy.orm import sessionmaker
# import os
#
# # CRITICAL DATABASE URL RULE: Reads DATABASE_URL from environment variables
# DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/grade_tracker_db")
#
# engine = create_engine(DATABASE_URL)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
#
# Base = declarative_base()
#
# # Dependency to get a DB session
# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()