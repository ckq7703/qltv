# Cấu hình ứng dụng, đọc từ biến môi trường / file .env
from pydantic_settings import BaseSettings, SettingsConfigDict


# Các thiết lập của app. database_url và redis_url bắt buộc phải có trong .env;
# jwt_secret mặc định chỉ dùng khi dev, production phải đổi.
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    redis_url: str
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_minutes: int = 30
    jwt_refresh_ttl_days: int = 7


settings = Settings()
