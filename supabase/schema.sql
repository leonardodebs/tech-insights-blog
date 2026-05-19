-- Tabela de posts do blog
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'Cloud',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index para listagem por data
CREATE INDEX IF NOT EXISTS posts_date_idx ON posts (date DESC);

-- Index para filtro por categoria
CREATE INDEX IF NOT EXISTS posts_category_idx ON posts (category);

-- Habilitar Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Leitura pública (anon key pode ler)
CREATE POLICY "Public read" ON posts
  FOR SELECT USING (true);

-- Inserção/atualização apenas via service role (usada pelo CI)
CREATE POLICY "Service write" ON posts
  FOR ALL USING (auth.role() = 'service_role');
