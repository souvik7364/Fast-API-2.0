from fastapi import APIRouter, Depends, status, HTTPException, Response
from sqlalchemy.orm import session
from .. import database, schemas, models, utils, oauth2

router = APIRouter(
    tags = ['Authentication']
)

@router.post('/login', response_model=schemas.Token)
def login(user_cred: schemas.UserLogin, db: session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == user_cred.email).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Invalid Credentials")

    if not utils.verify(user_cred.password, user.password):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Invalid Credentials")

    access_token = oauth2.create_access_token(data= {"user_id": user.id})

    return {"access_token": access_token, "token_type": "bearer"}