from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models, oauth2, schemas
from ..database import get_db


router = APIRouter(tags=["Replies"])


@router.post(
    "/posts/{post_id}/replies",
    response_model=schemas.ReplyOut,
    status_code=status.HTTP_201_CREATED,
)
def create_reply(
    post_id: int,
    reply: schemas.ReplyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(oauth2.get_current_user),
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post with id {post_id} does not exist",
        )

    new_reply = models.Reply(
        content=reply.content,
        post_id=post_id,
        owner_id=current_user.id,
    )
    db.add(new_reply)
    db.commit()
    db.refresh(new_reply)
    return new_reply


@router.get("/posts/{post_id}/replies", response_model=list[schemas.ReplyOut])
def get_replies(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(oauth2.get_current_user),
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post with id {post_id} does not exist",
        )

    return (
        db.query(models.Reply)
        .filter(models.Reply.post_id == post_id)
        .order_by(models.Reply.created_at.asc(), models.Reply.id.asc())
        .all()
    )


@router.delete("/replies/{reply_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reply(
    reply_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(oauth2.get_current_user),
):
    reply_query = db.query(models.Reply).filter(models.Reply.id == reply_id)
    reply = reply_query.first()
    if reply is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reply with id {reply_id} does not exist",
        )
    if reply.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own replies",
        )

    reply_query.delete(synchronize_session=False)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
