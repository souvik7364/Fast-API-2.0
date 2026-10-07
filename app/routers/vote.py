from fastapi import Response, status, HTTPException, Depends, APIRouter
from sqlalchemy.orm import Session
from .. import schemas, database, models, oauth2

router = APIRouter(
    tags = ['Likes']
)

def _like_post(post_id: int, db: Session, current_user: models.User):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Post with id {post_id} does not exist")

    existing_like = db.query(models.Vote).filter(
        models.Vote.post_id == post_id,
        models.Vote.user_id == current_user.id,
    ).first()
    if existing_like:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You already like this post")

    db.add(models.Vote(post_id=post_id, user_id=current_user.id))
    db.commit()
    return {"message": "Post liked"}


def _unlike_post(post_id: int, db: Session, current_user: models.User):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Post with id {post_id} does not exist")

    like_query = db.query(models.Vote).filter(
        models.Vote.post_id == post_id,
        models.Vote.user_id == current_user.id,
    )
    if like_query.first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="You have not liked this post")

    like_query.delete(synchronize_session=False)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/posts/{post_id}/like", status_code=status.HTTP_201_CREATED)
def like_post(post_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(oauth2.get_current_user)):
    return _like_post(post_id, db, current_user)


@router.get("/posts/{post_id}/like")
def get_like_status(post_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(oauth2.get_current_user)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Post with id {post_id} does not exist")

    liked = db.query(models.Vote).filter(
        models.Vote.post_id == post_id,
        models.Vote.user_id == current_user.id,
    ).first() is not None
    return {"liked": liked}


@router.delete("/posts/{post_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def unlike_post(post_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(oauth2.get_current_user)):
    return _unlike_post(post_id, db, current_user)


@router.post("/vote/", status_code=status.HTTP_201_CREATED, include_in_schema=False)
def vote(vote: schemas.Vote, db: Session = Depends(database.get_db), current_user: models.User = Depends(oauth2.get_current_user)):
    if vote.dir == 1:
        return _like_post(vote.post_id, db, current_user)
    return _unlike_post(vote.post_id, db, current_user)
