# POLPO // Analytics

Dashboard de Instagram growth conectado a Supabase. Estética SNCTVM.

## Estructura

```
polpo-analytics/
├── index.html       ← markup
├── styles.css       ← estilos SNCTVM
├── config.js        ← URL + anon key de Supabase (EDITAR)
├── dashboard.js     ← lógica de gráficas
├── app.js           ← auth + DB fetch
└── README.md
```

## Setup → 4 pasos

### 1) Configurar `config.js`

En Supabase Studio: `Settings → API`. Copia:
- `Project URL` → `SUPABASE_URL`
- `anon public` → `SUPABASE_ANON_KEY`

```js
// config.js
window.POLPO_CONFIG = {
  SUPABASE_URL: 'https://xxxxxxxxxxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...'
};
```

> La anon key es **pública por diseño**. La seguridad real la dan las RLS policies del paso 2.

### 2) Habilitar RLS y crear policies

#### 2.0 Verificación previa (si tienes otros proyectos conectados)

Si ya tienes otros proyectos/bots conectados a esta DB y NO quieres romper nada, primero verifica con qué role conectan:

```sql
-- Ver qué roles tienen BYPASSRLS (no se ven afectados por RLS)
SELECT rolname, rolbypassrls, rolsuper
FROM pg_roles
WHERE rolname IN ('postgres', 'anon', 'authenticated', 'service_role')
ORDER BY rolname;
```

**Resultado esperado:**
- `postgres` → `rolbypassrls = true` (admin, bypassea RLS)
- `service_role` → `rolbypassrls = true` (bypassea RLS)
- `authenticated` → `rolbypassrls = false` (RLS aplica)
- `anon` → `rolbypassrls = false` (RLS aplica)

**Si tu otro proyecto conecta vía:**
| Conexión | Role usado | ¿RLS le afecta? |
|---|---|---|
| Supavisor pooler (`...pooler.supabase.com:6543`) | `postgres` | ❌ NO (bypassrls) |
| Direct connection (`db.xxx.supabase.co:5432`) | `postgres` | ❌ NO (bypassrls) |
| API REST con service_role key | `service_role` | ❌ NO (bypassrls) |
| API REST con anon key | `anon` | ✅ SÍ |
| API REST con JWT user | `authenticated` | ✅ SÍ |

Las primeras 3 (las más comunes para bots) son seguras de tocar.

#### 2.1 Activar RLS

En `Database → SQL Editor`, corre esto:

```sql
-- Activar Row Level Security
ALTER TABLE stand_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE polpo_users ENABLE ROW LEVEL SECURITY;

-- Solo usuarios autenticados pueden leer
CREATE POLICY "polpo_read_stand_users"
  ON stand_users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "polpo_read_polpo_users"
  ON polpo_users FOR SELECT
  TO authenticated
  USING (true);
```

Sin esto, la anon key permitiría que cualquiera leyera tus datos. Con RLS activado y policies que requieren `authenticated`, **solo tu usuario logueado puede leer**.

> Tu bot (que escribe a la DB) debe usar la **service role key** o conexión directa Postgres (pooler/direct), no la anon key — esa sí es secreta y no se sube al frontend.

#### 2.2 Verificación post-activación

Para confirmar que tu otro proyecto sigue jalando, corre desde el OTRO proyecto algo simple como:

```sql
SELECT count(*) FROM stand_users;
```

Si responde el número correcto, todo OK. Si te da error tipo `permission denied` o `0 rows`, el otro proyecto NO está usando postgres role — avísame y vemos otra ruta.

### 3) Crear tu usuario

En `Authentication → Users → Add user → Create new user`:
- Email: el tuyo
- Password: el que quieras
- ☑ Auto Confirm User

Ese es el email/password que usarás en el login del dashboard.

### 4) Inserción del row "self"

El dashboard espera una fila en `stand_users` con `status = 'self'` para mostrar tu perfil propio:

```sql
INSERT INTO stand_users (username, status, profile_followers, profile_following, profile_ratio)
VALUES ('tu_usuario_ig', 'self', 250, 180, 1.3889)
ON CONFLICT (username) DO UPDATE
  SET profile_followers = EXCLUDED.profile_followers,
      profile_following = EXCLUDED.profile_following,
      profile_ratio = EXCLUDED.profile_ratio,
      status = 'self';
```

Tu bot puede actualizar este row cada vez que checa tu perfil.

## Deploy a GitHub Pages

1. Push a un repo público (o privado con Pro):
   ```bash
   git init
   git add .
   git commit -m "init polpo analytics"
   git branch -M main
   git remote add origin https://github.com/-bynd/polpo-analytics.git
   git push -u origin main
   ```
2. `Settings → Pages → Source: Deploy from branch → main / (root)`
3. Espera ~1 min, accede en `https://-bynd.github.io/polpo-analytics/`

> **OJO:** `config.js` con tu anon key se sube al repo público. Eso está bien (la anon key es pública por diseño), **siempre y cuando** tengas RLS activado correctamente. Sin RLS, exponer la anon key es peligroso.

## self_history.csv (opcional)

Las gráficas de crecimiento personal (followers/following/ratio en el tiempo) usan un CSV separado porque tu schema actual no tiene tabla de historial. Después del login, dentro del dashboard sale un drop-zone para subir `self_history.csv` con formato:

```csv
timestamp,username,followers,following,ratio
2024-01-01T10:00:00,tu_usuario,200,180,1.1111
2024-01-02T10:00:00,tu_usuario,205,180,1.1389
```

Si quieres meter eso a la DB también, créate una tabla:

```sql
CREATE TABLE self_history (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  username VARCHAR(50) NOT NULL,
  followers INTEGER NOT NULL,
  following INTEGER NOT NULL,
  ratio NUMERIC(10,4) NOT NULL
);
ALTER TABLE self_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "polpo_read_self_history" ON self_history FOR SELECT TO authenticated USING (true);
```

Y avísame para extender `app.js` y leer de ahí también.

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `✗ config.js no está configurado` | placeholders sin reemplazar | edita `config.js` |
| `✗ Invalid login credentials` | email/password mal | revisa Auth panel |
| `Error cargando de Supabase` con 0 rows | RLS bloqueando lectura | corre las policies del paso 2 |
| Charts no se muestran | sin filas con `status='active'` y `origen != 'unknown'` | revisa data en Table Editor |
| Login funciona pero queda en "cargando..." infinito | red bloqueada / CORS / RLS bug | abre DevTools → Console |

— -bynd
