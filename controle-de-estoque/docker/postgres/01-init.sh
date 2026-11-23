#!/bin/sh
# Roda uma vez, na primeira subida do banco, como o usuário administrador.
# A aplicação usa o papel estoque_app, que só tem os privilégios de que precisa.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_pass="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE estoque_app LOGIN PASSWORD :'app_pass';

CREATE TABLE produto (
  id         serial  PRIMARY KEY,
  nome       text    NOT NULL,
  quantidade integer NOT NULL CHECK (quantidade >= 0)
);

CREATE TABLE pedido (
  id          serial      PRIMARY KEY,
  produto_id  integer     NOT NULL REFERENCES produto (id),
  cliente_ref text        NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO estoque_app;
-- UPDATE em produto também cobre o SELECT ... FOR UPDATE da técnica de bloqueio.
GRANT SELECT, UPDATE ON produto TO estoque_app;
GRANT SELECT, INSERT ON pedido TO estoque_app;
GRANT USAGE ON SEQUENCE pedido_id_seq TO estoque_app;

-- Dado fictício para a demonstração: a última unidade.
INSERT INTO produto (nome, quantidade) VALUES ('Celular de demonstração', 1);
SQL
