-- Tabla para la lista de campeones de la Copa LD.
-- Pegalo en Supabase: SQL Editor -> New query -> Run.
create table if not exists campeones (
  id bigint generated always as identity primary key,
  nombre text not null,
  dificultad smallint not null default 0,
  rival text,
  resultado text,
  puntos_en_contra smallint,
  creado timestamptz not null default now()
);
-- Nadie entra desde afuera: solo el servidor del juego, con su clave secreta.
alter table campeones enable row level security;

-- Si la tabla ya existía de antes, esto agrega la columna nueva (no borra nada):
alter table campeones add column if not exists puntos_en_contra smallint;
