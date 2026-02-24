from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = 'postgresql://neondb_owner:npg_k4lO8BcniAjF@ep-long-brook-a1tidl2l-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)