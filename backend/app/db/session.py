from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings

settings = get_settings() #get settings and important env variables. 

engine = create_engine(settings.database_url, pool_pre_ping=True)   #engine creates a pool of connections to db, and hands them when sessions need them
                                                                    #pool_pre_ping = true makes sure to check a connection health(with a ping) before handing it to session, because sometimes database closes idle connections. Session using such conenctions will lead to error. 

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)  #creates a Session factory which produces sessions.  #bind=engine -> attach this session factory to this engine :) 
 #autocommit(false): don't submit until i say, autoflush(false): don't save until I say. Difference? just search it up pls ifyd remember. 


#this is a python generator function and returns a generator object. 
#now might be good time to learn about pyhton generator functions if you are not familiar. 
def get_db():
    db = SessionLocal()   #creates a brand new database Session.
    try:
        yield db          #on myDB = next(generator) it runs sessionLocal() and yields the session. 
    finally:                  #fastApi can use that session in your route endpoint 
        db.close()        #then again on next(generator), this code runs and closes your session.
                          #fastAPI does this[next(generator)] even when your route fails with some exception or succeeds to close the session. 