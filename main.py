from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from typing import List

from database import create_db_and_tables, get_session
from models import User, Post, Comment, UserCreate, UserUpdate, UserLogin
from security import get_password_hash, verify_password
from aws_service import upload_file_to_s3

app = FastAPI(title="VNKMedia API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.post("/register/", response_model=User)
def register_user(user_data: UserCreate, session: Session = Depends(get_session)):
    existing_user = session.exec(select(User).where(User.username == user_data.username)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está en uso")
    
    new_user = User(
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password)
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user

@app.post("/login/")
def login(user_data: UserLogin, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == user_data.username)).first()
    
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    
    return {"message": "Login exitoso", "user_id": user.id, "username": user.username}

@app.patch("/users/{user_id}", response_model=User)
def update_profile(user_id: int, user_update: UserUpdate, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    update_data = user_update.dict(exclude_unset=True)

    if "password" in update_data:
        user.hashed_password = get_password_hash(update_data["password"])
        del update_data["password"]
        
    for key, value in update_data.items():
        setattr(user, key, value)
        
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@app.post("/users/{user_id}/profile_pic")
def upload_profile_pic(user_id: int, file: UploadFile = File(...), session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    try:
        s3_url = upload_file_to_s3(file, folder="profiles")
        user.profile_pic_url = s3_url
        session.add(user)
        session.commit()
        return {"message": "Foto de perfil actualizada", "profile_pic_url": s3_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/posts/", response_model=Post)
def create_post(
    user_id: int = Form(...), 
    title: str = Form(...), 
    description: str = Form(None), 
    file: UploadFile = File(...), 
    session: Session = Depends(get_session)
):

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        

    try:
        s3_url = upload_file_to_s3(file, folder="posts")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir imagen a S3: {str(e)}")
        
    new_post = Post(
        title=title,
        description=description,
        image_url=s3_url,
        user_id=user_id
    )
    
    session.add(new_post)
    session.commit()
    session.refresh(new_post)
    return new_post

@app.get("/posts/", response_model=List[Post])
def get_global_feed(session: Session = Depends(get_session)):
    """Obtiene todas las publicaciones (Feed global)."""

    query = select(Post).order_by(Post.created_at.desc())
    return session.exec(query).all()

@app.get("/posts/{post_id}", response_model=Post)
def get_post_detail(post_id: int, session: Session = Depends(get_session)):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    return post

@app.delete("/posts/{post_id}")
def delete_post(post_id: int, session: Session = Depends(get_session)):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")

    session.delete(post)
    session.commit()
    return {"message": "Publicación eliminada correctamente"}


@app.post("/posts/{post_id}/comments", response_model=Comment)
def create_comment(post_id: int, user_id: int, text: str, session: Session = Depends(get_session)):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
        
    new_comment = Comment(text=text, user_id=user_id, post_id=post_id)
    session.add(new_comment)
    session.commit()
    session.refresh(new_comment)
    return new_comment

@app.get("/posts/{post_id}/comments", response_model=List[Comment])
def get_post_comments(post_id: int, session: Session = Depends(get_session)):
    query = select(Comment).where(Comment.post_id == post_id).order_by(Comment.created_at.desc())
    return session.exec(query).all()