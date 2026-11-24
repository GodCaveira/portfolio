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

-- Painel: só administradores, sem cadastro público.
CREATE TABLE administrador (
  id                serial      PRIMARY KEY,
  email             text        NOT NULL UNIQUE,
  senha_hash        text        NOT NULL,
  -- Segredo TOTP cifrado com AES-256-GCM; NULL até o primeiro cadastro do MFA.
  totp_cifrado      text,
  -- Último passo de 30 s aceito: o mesmo código não entra duas vezes.
  totp_ultimo_passo bigint,
  -- Tentativas de senha e de código desde o último login completo.
  tentativas        integer     NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  bloqueado_ate     timestamptz
);

CREATE TABLE codigo_recuperacao (
  id               serial      PRIMARY KEY,
  administrador_id integer     NOT NULL REFERENCES administrador (id) ON DELETE CASCADE,
  hash             text        NOT NULL,
  usado_em         timestamptz,
  UNIQUE (administrador_id, hash)
);

-- O cookie leva o token; aqui fica só o SHA-256 dele.
CREATE TABLE sessao (
  token_hash            text        PRIMARY KEY,
  administrador_id      integer     NOT NULL REFERENCES administrador (id) ON DELETE CASCADE,
  etapa                 text        NOT NULL CHECK (etapa IN ('mfa', 'cadastro_mfa', 'completa')),
  totp_pendente_cifrado text,
  expira_em             timestamptz NOT NULL
);

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO estoque_app;
-- UPDATE em produto também cobre o SELECT ... FOR UPDATE da técnica de bloqueio.
GRANT SELECT, UPDATE ON produto TO estoque_app;
GRANT SELECT, INSERT ON pedido TO estoque_app;
GRANT USAGE ON SEQUENCE pedido_id_seq TO estoque_app;
-- Sem DELETE em administrador: a aplicação não apaga contas.
GRANT SELECT, INSERT, UPDATE ON administrador TO estoque_app;
GRANT USAGE ON SEQUENCE administrador_id_seq TO estoque_app;
GRANT SELECT, INSERT, UPDATE ON codigo_recuperacao TO estoque_app;
GRANT USAGE ON SEQUENCE codigo_recuperacao_id_seq TO estoque_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessao TO estoque_app;

-- Dado fictício para a demonstração: a última unidade.
INSERT INTO produto (nome, quantidade) VALUES ('Celular de demonstração', 1);
SQL
