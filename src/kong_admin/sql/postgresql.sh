docker run \
    -p 5432:5432 \
    -e POSTGRES_USER=kong \
    -e POSTGRES_DB=kong \
    -e POSTGRES_PASSWORD=kong \
    postgres:latest