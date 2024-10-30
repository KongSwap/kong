docker run -d \
    --name kong_postgres \
    -e POSTGRES_USER=kong \
    -e POSTGRES_DB=kong \
    -e POSTGRES_PASSWORD=kong \
    -p 5432:5432 \
    -v postgres_data:/var/lib/postgresql/data \
    postgres:latest