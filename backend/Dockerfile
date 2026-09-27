FROM python:3.12-slim

WORKDIR /app

# psycopg2-binary bundles libpq — không cần cài libpq-dev/gcc qua apt (tránh phụ thuộc mirror chậm).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
