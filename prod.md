# Voice Notes App – Production Deployment Documentation

This document describes the production deployment of the **Voice Notes Flask application** on an OVH VPS (Ubuntu) using:

- Flask
- Gunicorn
- systemd
- Nginx
- PostgreSQL
- Let's Encrypt (Certbot)



---

## 1. Architecture Overview

Browser  
↓ HTTPS (443)  
Nginx (reverse proxy)  
↓ http://127.0.0.1:8000  
Gunicorn (WSGI server)  
↓  
Flask App  
↓  
PostgreSQL

---

## 4. Python Environment Setup

```bash
# Create and activate virtualenv, install deps
cd ~/Github/voice-notes-mvp
python3 -m venv .venv
source .venv/bin/activate
pip install flask gunicorn psycopg2-binary
```

---

## 5. Production-Ready Flask App (app.py)

```python
from flask import Flask
import os

def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "change-this")

    @app.route("/")
    def health():
        return {"status": "ok"}, 200

    return app

app = create_app()

if __name__ == "__main__":
    # Local development only
    app.run(host="127.0.0.1", port=5000, debug=False)
```

> Note: `app.run()` is NOT used in production. Gunicorn runs the app instead.

---

## 6. Gunicorn Manual Test (Optional)

```bash
source .venv/bin/activate
gunicorn -w 3 -b 127.0.0.1:8000 app:app
# Verify:
curl http://127.0.0.1:8000
# Stop with CTRL+C
```

---

## 7. systemd Service (Production Gunicorn)

Create `/etc/systemd/system/voicenotes.service` with:

```ini
[Unit]
Description=Voice Notes Flask App (Gunicorn)
After=network.target

[Service]
User=anish
Group=www-data
WorkingDirectory=/home/anish/Github/voice-notes-mvp
Environment="PATH=/home/anish/Github/voice-notes-mvp/.venv/bin"
Environment="FLASK_ENV=production"
Environment="FLASK_DEBUG=0"

ExecStart=/home/anish/Github/voice-notes-mvp/.venv/bin/gunicorn \
          -w 3 \
          -b 127.0.0.1:8000 \
          app:app

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable & start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable voicenotes
sudo systemctl start voicenotes
sudo systemctl status voicenotes
sudo systemctl restart voicenotes
```

---

## 8. Install & Configure Nginx

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 9. Nginx Site Configuration

Create `/etc/nginx/sites-available/vcn.yti.org.in` with:

```nginx
server {
    listen 80;
    server_name vcn.yti.org.in;

    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/vcn.yti.org.in /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Test HTTP:  
http://vcn.yti.org.in

---

## 10. HTTPS (Let's Encrypt / Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d vcn.yti.org.in
# Follow prompts: agree to Terms, provide email (optional), enable HTTP->HTTPS redirect
```

Certbot will create SSL config, reload nginx, and set up auto-renewal.

---

## 11. Final Verification

```bash
sudo systemctl status voicenotes
sudo systemctl status nginx
ss -tulpn | grep 8000
ss -tulpn | grep 443
# Test site:
https://vcn.yti.org.in
```

---

## 12. Operational Notes

- Gunicorn runs via systemd only.
- No Gunicorn processes should be left in tmux.
- Flask debug mode is OFF.
- App survives SSH logout & reboots.
- HTTPS is mandatory for microphone access in browsers.

---

## 13. Backup & Safety (Recommended)

```bash
pg_dump -U resource_user -F c -b -f resource_db_$(date +%F).dump resource_db
```

Do NOT push DB dumps to GitHub.

---

## 14. Production Status

- ✅ DNS configured  
- ✅ Gunicorn + systemd  
- ✅ Nginx reverse proxy  
- ✅ HTTPS enabled  
- ✅ PostgreSQL connected  
- ✅ Production-ready deployment
