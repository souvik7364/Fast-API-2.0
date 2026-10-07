from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, oauth2, schemas, utils
from ..database import get_db


router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    email = str(user.email).strip().lower()
    username = user.username.strip().lower()

    if db.query(models.User).filter(func.lower(models.User.email) == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    if db.query(models.User).filter(func.lower(models.User.username) == username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That username is already taken",
        )

    new_user = models.User(
        email=email,
        username=username,
        about="",
        password=utils.hash(user.password),
    )
    db.add(new_user)
    try:
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        email_exists = db.query(models.User).filter(
            func.lower(models.User.email) == email
        ).first()
        if email_exists:
            detail = "An account with this email already exists"
        else:
            detail = "That username is already taken"
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from None

    return new_user


@router.get("/me", response_model=schemas.UserOut)
def get_my_profile(current_user: models.User = Depends(oauth2.get_current_user)):
    return current_user


@router.patch("/me", response_model=schemas.UserOut)
def update_my_profile(
    profile: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(oauth2.get_current_user),
):
    updates = profile.model_dump(exclude_unset=True)

    if "username" in updates:
        if updates["username"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Username cannot be empty",
            )
        username = updates["username"].strip().lower()
        existing_user = db.query(models.User).filter(
            func.lower(models.User.username) == username,
            models.User.id != current_user.id,
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That username is already taken",
            )
        current_user.username = username

    if "about" in updates:
        current_user.about = updates["about"] or ""

    try:
        db.commit()
        db.refresh(current_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That username is already taken",
        ) from None

    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(oauth2.get_current_user),
):
    db.delete(current_user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/search", response_model=list[schemas.UserPublic])
def search_users(
    username: str = Query(min_length=1, max_length=30),
    limit: int = Query(default=10, ge=1, le=25),
    db: Session = Depends(get_db),
):
    query = username.strip().lower()
    return (
        db.query(models.User)
        .filter(func.lower(models.User.username).contains(query))
        .order_by(models.User.username)
        .limit(limit)
        .all()
    )


@router.get("/{username}", response_model=schemas.UserPublic)
def get_user_by_username(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        func.lower(models.User.username) == username.strip().lower()
    ).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User @{username} does not exist",
        )
    return user
