from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, oauth2, schemas
from ..database import get_db


router = APIRouter(prefix="/users", tags=["Users"])


def _get_user(username: str, db: Session):
    normalized_username = username.strip().lower()
    user = db.query(models.User).filter(
        func.lower(models.User.username) == normalized_username
    ).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User @{username} does not exist",
        )
    return user


@router.post("/{username}/follow", status_code=status.HTTP_201_CREATED, response_model=schemas.FollowOut)
def follow_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(oauth2.get_current_user),
):
    followed_user = _get_user(username, db)
    if current_user.id == followed_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot follow yourself",
        )

    existing_follow = db.query(models.Follow).filter(
        models.Follow.follower_id == current_user.id,
        models.Follow.followed_id == followed_user.id,
    ).first()
    if existing_follow is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"You already follow @{followed_user.username}",
        )

    follow = models.Follow(
        follower_id=current_user.id,
        followed_id=followed_user.id,
    )
    db.add(follow)
    db.commit()
    db.refresh(follow)
    return {
        "follower_username": current_user.username,
        "followed_username": followed_user.username,
        "created_at": follow.created_at,
    }


@router.delete("/{username}/follow", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(oauth2.get_current_user),
):
    followed_user = _get_user(username, db)
    follow = db.query(models.Follow).filter(
        models.Follow.follower_id == current_user.id,
        models.Follow.followed_id == followed_user.id,
    ).first()
    if follow is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"You do not follow @{followed_user.username}",
        )

    db.delete(follow)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{username}/followers", response_model=list[schemas.UserPublic])
def get_followers(username: str, db: Session = Depends(get_db)):
    user = _get_user(username, db)
    return (
        db.query(models.User)
        .join(models.Follow, models.Follow.follower_id == models.User.id)
        .filter(models.Follow.followed_id == user.id)
        .order_by(models.Follow.created_at.desc())
        .all()
    )


@router.get("/{username}/following", response_model=list[schemas.UserPublic])
def get_following(username: str, db: Session = Depends(get_db)):
    user = _get_user(username, db)
    return (
        db.query(models.User)
        .join(models.Follow, models.Follow.followed_id == models.User.id)
        .filter(models.Follow.follower_id == user.id)
        .order_by(models.Follow.created_at.desc())
        .all()
    )
