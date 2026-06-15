from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from typing import List

from database import create_db_and_tables, get_session
from models import User, Post, Comment, UserCreate, UserUpdate, UserLogin, Tag, Like, PostTagLink, SavedPost
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

# ==========================================
# ENDPOINTS DE USUARIOS
# ==========================================

@app.post("/register/", response_model=User)
def register_user(user_data: UserCreate, session: Session = Depends(get_session)):
    existing_user = session.exec(select(User).where(User.username == user_data.username)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="El correo ya está en uso")
    
    # Asignamos la primera parte del correo como nombre por defecto (ej. dylan@gmail.com -> dylan)
    default_name = user_data.username.split("@")[0][:18]
    
    new_user = User(
        username=user_data.username,
        display_name=default_name,
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
    
    return {"message": "Login exitoso", "user_id": user.id, "display_name": user.display_name}

@app.get("/users/{user_id}", response_model=User)
def get_user_profile(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user

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

@app.get("/users/{user_id}/posts")
def get_user_posts(user_id: int, session: Session = Depends(get_session)):
    query = select(Post).where(Post.user_id == user_id).order_by(Post.created_at.desc())
    posts = session.exec(query).all()
    # Devolvemos solo lo necesario en formato diccionario
    return [{"id": p.id, "title": p.title, "image_url": p.image_url} for p in posts]

# ==========================================
# ENDPOINTS DE PUBLICACIONES, BÚSQUEDA Y TAGS
# ==========================================

@app.post("/posts/")
def create_post(
    user_id: int = Form(...), 
    title: str = Form(...), 
    description: str = Form(None),
    tags_string: str = Form(None), # Recibirá: "origami, papel, arte"
    file: UploadFile = File(...), 
    session: Session = Depends(get_session)
):
    try:
        s3_url = upload_file_to_s3(file, folder="posts")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir imagen a S3: {str(e)}")
        
    new_post = Post(title=title, description=description, image_url=s3_url, user_id=user_id)
    
    # Procesamiento inteligente de etiquetas
    if tags_string:
        etiquetas = [t.strip().lower() for t in tags_string.split(",")]
        for nombre in etiquetas:
            if not nombre: continue
            # Revisamos si la etiqueta ya existe en la base de datos
            tag_db = session.exec(select(Tag).where(Tag.name == nombre)).first()
            if not tag_db:
                tag_db = Tag(name=nombre)
                session.add(tag_db)
            new_post.tags.append(tag_db)
    
    session.add(new_post)
    session.commit()
    session.refresh(new_post)
    return new_post

@app.get("/posts/")
def get_global_feed(session: Session = Depends(get_session)):
    query = select(Post).order_by(Post.created_at.desc())
    return session.exec(query).all()

@app.get("/posts/{post_id}")
def get_post_detail(post_id: int, session: Session = Depends(get_session)):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    return {
        "id": post.id, "title": post.title, "description": post.description,
        "image_url": post.image_url, "created_at": post.created_at, "user_id": post.user_id,
        "tags": [tag.name for tag in post.tags]
    }

# Búsqueda dinámica y filtrado por Etiquetas
@app.get("/search/")
def search_posts(q: str, session: Session = Depends(get_session)):
    """Busca en el título, descripción o en las etiquetas"""
    termino = f"%{q.lower()}%"
    
    # Consulta avanzada para buscar en texto o en la tabla de tags
    query = select(Post).outerjoin(Post.tags).where(
        (Post.title.ilike(termino)) | 
        (Post.description.ilike(termino)) | 
        (Tag.name.ilike(termino))
    )
    # Evita publicaciones duplicadas si coincide con 2 etiquetas
    resultados = session.exec(query).unique().all()
    return resultados

# Las etiquetas más populares para la barra de categorías
@app.get("/tags/popular")
def get_popular_tags(session: Session = Depends(get_session)):
    tags = session.exec(select(Tag)).all()
    # Contamos cuántas publicaciones tiene cada etiqueta y ordenamos
    tags_con_conteo = [{"name": t.name, "count": len(t.posts)} for t in tags]
    tags_con_conteo.sort(key=lambda x: x["count"], reverse=True)
    return tags_con_conteo[:10] # Devolvemos el Top 10

# ==========================================
# ENDPOINTS DE LIKES
# ==========================================

@app.post("/posts/{post_id}/like")
def toggle_like(post_id: int, user_id: int, session: Session = Depends(get_session)):
    """Da like o quita el like si ya lo tenía"""
    existing_like = session.exec(select(Like).where(Like.post_id == post_id, Like.user_id == user_id)).first()
    
    if existing_like:
        session.delete(existing_like)
        session.commit()
        return {"message": "Like removido", "liked": False}
    else:
        new_like = Like(user_id=user_id, post_id=post_id)
        session.add(new_like)
        session.commit()
        return {"message": "Like agregado", "liked": True}

@app.get("/posts/{post_id}/likes/count")
def get_likes_info(post_id: int, user_id: int = 0, session: Session = Depends(get_session)):
    """Devuelve cuántos likes tiene y si el usuario actual le dio like"""
    likes = session.exec(select(Like).where(Like.post_id == post_id)).all()
    usuario_dio_like = any(like.user_id == user_id for like in likes)
    return {"total_likes": len(likes), "user_liked": usuario_dio_like}

# ==========================================
# ENDPOINTS DE COMENTARIOS
# ==========================================

@app.post("/posts/{post_id}/comments", response_model=Comment)
def create_comment(post_id: int, user_id: int, text: str, session: Session = Depends(get_session)):
    new_comment = Comment(text=text, user_id=user_id, post_id=post_id)
    session.add(new_comment)
    session.commit()
    session.refresh(new_comment)
    return new_comment

@app.get("/posts/{post_id}/comments", response_model=List[Comment])
def get_post_comments(post_id: int, session: Session = Depends(get_session)):
    query = select(Comment).where(Comment.post_id == post_id).order_by(Comment.created_at.desc())
    return session.exec(query).all()

@app.post("/posts/{post_id}/save")
def toggle_save_post(post_id: int, user_id: int, session: Session = Depends(get_session)):
    """Guarda un post, o lo quita de guardados si ya lo estaba"""
    existing_save = session.exec(select(SavedPost).where(SavedPost.post_id == post_id, SavedPost.user_id == user_id)).first()
    
    if existing_save:
        session.delete(existing_save)
        session.commit()
        return {"message": "Post removido de guardados", "saved": False}
    else:
        new_save = SavedPost(user_id=user_id, post_id=post_id)
        session.add(new_save)
        session.commit()
        return {"message": "Post guardado", "saved": True}

@app.get("/posts/{post_id}/save/status")
def check_save_status(post_id: int, user_id: int, session: Session = Depends(get_session)):
    """Revisa si el usuario actual ya guardó este post"""
    existing_save = session.exec(select(SavedPost).where(SavedPost.post_id == post_id, SavedPost.user_id == user_id)).first()
    return {"saved": bool(existing_save)}

@app.get("/users/{user_id}/saved_posts")
def get_user_saved_posts(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # Devolvemos solo lo necesario en formato diccionario
    return [{"id": p.id, "title": p.title, "image_url": p.image_url} for p in user.saved_posts]

@app.delete("/posts/{post_id}")
def delete_post(post_id: int, user_id: int, session: Session = Depends(get_session)):
    """Borra una publicación y todo su rastro si el usuario es el dueño"""
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    
    # 1. Seguridad de nivel 1: Verificar que quien borra es el dueño
    if post.user_id != user_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para borrar esta publicación")

    # 2. Limpieza profunda para evitar errores de base de datos
    # Borramos los Likes asociados
    likes = session.exec(select(Like).where(Like.post_id == post_id)).all()
    for like in likes: session.delete(like)
    
    # Borramos los Guardados asociados
    saves = session.exec(select(SavedPost).where(SavedPost.post_id == post_id)).all()
    for save in saves: session.delete(save)
    
    # Borramos las conexiones con las Etiquetas
    tag_links = session.exec(select(PostTagLink).where(PostTagLink.post_id == post_id)).all()
    for link in tag_links: session.delete(link)

    # (Los comentarios se borran automáticamente porque le pusimos cascade_delete=True en models.py)

    # 3. Borramos el Post final
    session.delete(post)
    session.commit()
    
    return {"message": "Publicación borrada con éxito"}

# ==========================================
# ENDPOINT PARA SUBIR FOTO DE PERFIL (NUEVO)
# ==========================================

@app.post("/users/{user_id}/avatar")
def update_profile_pic(user_id: int, file: UploadFile = File(...), session: Session = Depends(get_session)):
    """Sube una imagen a S3 y la asigna como foto de perfil del usuario"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    try:
        # Subimos el archivo a S3 dentro de una carpeta llamada 'avatars'
        s3_url = upload_file_to_s3(file, folder="avatars")
        user.profile_pic_url = s3_url
        
        session.add(user)
        session.commit()
        session.refresh(user)
        
        return {"message": "Foto de perfil actualizada con éxito", "profile_pic_url": s3_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir avatar a S3: {str(e)}")