# Despliegue Molino en Ubuntu (Digital Ocean) con PM2

Guía paso a paso para configurar el servidor Ubuntu y ejecutar el software Molino con PM2.

---

## Requisitos previos

- Una cuenta en Digital Ocean con un Droplet Ubuntu (22.04 LTS recomendado).
- IP del servidor y acceso SSH (usuario `root` o usuario con sudo).
- Repositorio en GitHub: `https://github.com/AlmaIntelligenceLtda/molino.git`
- Base de datos: el proyecto usa **Neon** (Postgres en la nube). Si ya tienes una base en Neon, solo necesitas la `DATABASE_URL`.

---

## Paso 1 — Conectarte al servidor

Desde tu PC (PowerShell o terminal):

```bash
ssh root@TU_IP_DEL_SERVIDOR
```

(Reemplaza `TU_IP_DEL_SERVIDOR` por la IP que te dio Digital Ocean.)

Si usas clave SSH:

```bash
ssh -i ruta/a/tu/clave.pem root@TU_IP_DEL_SERVIDOR
```

---

## Paso 2 — Actualizar el sistema

```bash
apt update && apt upgrade -y
```

---

## Paso 3 — Crear un usuario para la aplicación (recomendado)

No es obligatorio, pero es buena práctica no correr todo como `root`:

```bash
adduser molino
usermod -aG sudo molino
su - molino
```

A partir de aquí puedes seguir como `molino` (usa `sudo` cuando haga falta). Si prefieres seguir como `root`, omite este paso y usa `root` en los siguientes.

---

## Paso 4 — Instalar Node.js (LTS)

Instalamos Node 20 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Comprueba:

```bash
node -v   # debe ser v20.x
npm -v
```

---

## Paso 5 — Instalar Git

```bash
sudo apt install -y git
```

---

## Paso 6 — Clonar el repositorio

Elige una carpeta donde vivirá la app, por ejemplo `/var/www` o en el home del usuario:

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
git clone https://github.com/AlmaIntelligenceLtda/molino.git
cd molino
```

Si el repo es privado, configura SSH o un token de GitHub antes de hacer `git clone`.

---

## Paso 7 — Instalar dependencias

```bash
cd /var/www/molino
npm install --production
```

(Si fallan dependencias nativas, puede que necesites `build-essential`: `sudo apt install -y build-essential`.)

---

## Paso 8 — Configurar variables de entorno (.env)

Crea el archivo `.env` en la raíz del proyecto (donde está `package.json`):

```bash
nano /var/www/molino/.env
```

Contenido mínimo (ajusta los valores):

```env
# Puerto donde escuchará la app (por defecto 3000)
PORT=3000

# Clave secreta para JWT (genera una aleatoria larga)
JWT_SECRET=tu_clave_secreta_muy_larga_y_aleatoria_aqui

# Base de datos Neon (Postgres)
DATABASE_URL=postgresql://usuario:password@host.neon.tech/nombre_db?sslmode=require

# Opcional: Ably para tiempo real
# ABLY_API_KEY=tu_ably_api_key
```

Para generar un `JWT_SECRET` aleatorio:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guarda el archivo (en nano: `Ctrl+O`, Enter, `Ctrl+X`).

---

## Paso 9 — Instalar PM2

```bash
sudo npm install -g pm2
```

Comprueba:

```bash
pm2 -v
```

---

## Paso 10 — Configurar PM2 con el ecosistema del proyecto

El proyecto incluye un archivo `ecosystem.config.cjs` en la raíz. Desde la raíz del proyecto:

```bash
cd /var/www/molino
pm2 start ecosystem.config.cjs
```

Comandos útiles:

```bash
pm2 status          # Ver estado de la app
pm2 logs molino     # Ver logs en tiempo real
pm2 restart molino  # Reiniciar
pm2 stop molino     # Parar
pm2 delete molino   # Quitar del listado de PM2
```

---

## Paso 11 — Hacer que PM2 arranque al reiniciar el servidor

```bash
pm2 startup
```

Ejecuta el comando que te muestre PM2 (algo como `sudo env PATH=... pm2 startup systemd ...`). Luego guarda la lista actual de procesos:

```bash
pm2 save
```

Así, al reiniciar el servidor, Molino volverá a levantarse solo.

---

## Paso 12 — Instalar Nginx como proxy inverso (recomendado)

Así la app puede escuchar en el puerto 80/443 y Nginx reparte el tráfico:

```bash
sudo apt install -y nginx
```

Crear configuración para tu sitio:

```bash
sudo nano /etc/nginx/sites-available/molino
```

Contenido (reemplaza `TU_DOMINIO_O_IP` por tu dominio o IP del servidor):

```nginx
server {
    listen 80;
    server_name TU_DOMINIO_O_IP;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activar el sitio y recargar Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/molino /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Abre en el navegador: `http://TU_IP_O_DOMINIO`. Deberías ver la app (login, etc.).

---

## Paso 13 — (Opcional) HTTPS con Let's Encrypt

Solo si tienes un **dominio** apuntando a la IP del servidor:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com
```

Sigue las instrucciones. Certbot configurará SSL y la renovación automática.

---

## Resumen de comandos útiles

| Acción              | Comando                    |
|---------------------|----------------------------|
| Ver estado          | `pm2 status`               |
| Logs                | `pm2 logs molino`          |
| Reiniciar           | `pm2 restart molino`       |
| Parar               | `pm2 stop molino`          |
| Actualizar código   | `cd /var/www/molino && git pull && npm install --production && pm2 restart molino` |

---

## Migraciones de base de datos

Si es la primera vez en este servidor y la base está vacía, puede que debas ejecutar las migraciones:

```bash
cd /var/www/molino
npm run db:migrate
# Si usas módulo maquila:
# npm run db:migrate:maquila
```

Luego reinicia la app:

```bash
pm2 restart molino
```

---

## Solución de problemas

- **La app no arranca**: Revisa `pm2 logs molino` y que `.env` tenga `DATABASE_URL` y `JWT_SECRET` correctos.
- **502 Bad Gateway**: La app no está escuchando en el puerto que usa Nginx (por defecto 3000). Revisa `pm2 status` y que en `.env` tengas `PORT=3000`.
- **No se conecta a la base**: Verifica `DATABASE_URL` (Neon suele usar `?sslmode=require`). Prueba la conexión desde tu PC con la misma URL si es posible.

Si quieres, en el siguiente paso podemos revisar juntos los logs o el contenido de tu `.env` (sin pegar contraseñas) para afinar la configuración.
