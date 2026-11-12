# Full CRUD Node.js App: Deploy to an AWS Ubuntu Server by Hand

This guide walks you through putting this Express app on the internet using an
**AWS EC2 Ubuntu server**, step by step, **without** Docker or a CI/CD
pipeline. You will do every step by hand so you understand what each piece does.

By the end, you will have:

- an Ubuntu server running on AWS
- Node.js running the app on port `3000`, kept alive by **PM2**
- **Nginx** in front of the app, serving it on port `80` (and `443` with HTTPS)
- a firewall that only lets the right traffic in
- a routine for backing up the data and deploying updates

> **How to read this guide**
> - Lines in grey boxes that start with `$` are commands. Type them **without** the `$`.
> - Text in `<ANGLE_BRACKETS>` is a placeholder. Replace it with your own value
>   (for example `<YOUR_SERVER_IP>` → `13.250.10.20`).
> - Do the steps **in order**. Each step assumes the previous one worked.
> - After most steps there is a **✅ Check** section. Don't move on until the check passes.

---

## Table of contents

0. [Understand the app first](#0-understand-the-app-first)
1. [The big picture](#1-the-big-picture)
2. [Launch an EC2 Ubuntu server](#2-launch-an-ec2-ubuntu-server)
3. [Connect to the server with SSH](#3-connect-to-the-server-with-ssh)
4. [Update the server](#4-update-the-server)
5. [Install Node.js and Git](#5-install-nodejs-and-git)
6. [Get the code onto the server](#6-get-the-code-onto-the-server)
7. [Run the app manually (first test)](#7-run-the-app-manually-first-test)
8. [The database](#8-the-database)
9. [Keep the app running with PM2](#9-keep-the-app-running-with-pm2)
10. [Install and configure Nginx](#10-install-and-configure-nginx)
11. [Turn on the firewall (UFW)](#11-turn-on-the-firewall-ufw)
12. [Domain name and Elastic IP (optional)](#12-domain-name-and-elastic-ip-optional)
13. [HTTPS with Let's Encrypt (optional, needs a domain)](#13-https-with-lets-encrypt-optional-needs-a-domain)
14. [Deploy an update](#14-deploy-an-update)
15. [Troubleshooting](#15-troubleshooting)
16. [Command cheat sheet](#16-command-cheat-sheet)
17. [Clean up so you are not charged](#17-clean-up-so-you-are-not-charged)
18. [Final checklist](#18-final-checklist)

---

## 0. Understand the app first

Before deploying anything, know what you are deploying.

```
full-crud-nodejs/
├── server.js            ← entry point, starts Express on port 3000
├── package.json         ← dependencies (express, uuid, axios, nodemon)
├── routes/
│   ├── user_route.js    ← /api/users  (GET, POST, PUT, DELETE)
│   └── post_route.js    ← /api/posts  (GET, POST, PUT, DELETE)
├── models/
│   ├── user_model.js    ← reads/writes database/users.json
│   └── post_model.js    ← reads/writes database/posts.json
├── utils/file_util.js   ← getData() / saveData() helpers
├── database/
│   ├── users.json       ← the "database" (plain JSON files)
│   └── posts.json
└── public/              ← frontend (HTML + JS) served by Express
    ├── index.html
    └── js/main.js
```

Key facts that matter for deployment:

| Fact | Why it matters |
|------|----------------|
| The app listens on **port 3000** (hard-coded in `server.js`). | Nginx must forward traffic to `localhost:3000`. |
| Data is stored in **JSON files** in `database/`, not in MySQL/PostgreSQL. | There is no database server to install for this app. You must back up these files (see [step 8](#8-the-database)). |
| The models open files with **relative paths** like `./database/users.json`. | The app **must be started from inside the project folder**, or it crashes with `ENOENT: no such file or directory`. |
| The frontend calls the API with relative URLs (`/api/users`). | Frontend and API are on the same domain, so no CORS setup is needed. |

### API endpoints

| Method | URL | What it does |
|--------|-----|--------------|
| GET | `/api/users` | list all users |
| GET | `/api/users/:id` | get one user |
| POST | `/api/users` | create a user (JSON body: `name`, `age`, `status`) |
| PUT | `/api/users/:id` | update a user |
| DELETE | `/api/users/:id` | delete a user |
| GET/POST/PUT/DELETE | `/api/posts...` | same idea for posts |

### Run it on your own computer first

```bash
$ npm install
$ node server.js
```

Open <http://localhost:3000>. If it does not work on your laptop, it will not
work on the server either. Fix it locally first.

---

## 1. The big picture

This is what you are building:

```
   Student's browser
          │
          │  http://<YOUR_SERVER_IP>   (port 80)
          │  https://<YOUR_DOMAIN>     (port 443)
          ▼
┌──────────────────── AWS EC2 (Ubuntu) ─────────────────────┐
│                                                           │
│   AWS Security Group  →  allows 22, 80, 443               │
│   UFW firewall        →  allows 22, 80, 443               │
│          │                                                │
│          ▼                                                │
│   ┌─────────────┐   proxy_pass    ┌────────────────────┐  │
│   │   Nginx     │ ──────────────▶ │ Node.js (Express)  │  │
│   │  port 80/443│                 │ port 3000          │  │
│   └─────────────┘                 │ managed by PM2     │  │
│                                   └─────────┬──────────┘  │
│                                             │ read/write  │
│                                             ▼             │
│                                   database/users.json     │
│                                   database/posts.json     │
└───────────────────────────────────────────────────────────┘
```

**Why use Nginx at all? Node can listen on a port by itself.**

- Ports below 1024 (like 80 and 443) need root. Running Node as root is a security risk. Nginx handles those ports and Node stays a normal user process on 3000.
- Nginx handles HTTPS certificates easily (with Certbot).
- Nginx is fast at serving files, can host several apps on one server, and keeps working cleanly when Node restarts.

**Why PM2?** If you run `node server.js` and close your SSH window, the app dies.
PM2 keeps it running in the background, restarts it if it crashes, and starts
it again when the server reboots.

---

## 2. Launch an EC2 Ubuntu server

1. Sign in to the **AWS Console** → search for **EC2** → click **Launch instance**.
2. Fill in the form:

   | Setting | Value |
   |---------|-------|
   | **Name** | `crud-nodejs-server` |
   | **AMI (OS image)** | **Ubuntu Server 24.04 LTS** (64-bit x86) |
   | **Instance type** | `t2.micro` or `t3.micro` (Free tier eligible) |
   | **Key pair** | Click **Create new key pair** → name `crud-key` → type **RSA** → format **.pem** → **Create**. The file `crud-key.pem` downloads. **Keep it safe. You cannot download it again.** |
   | **Storage** | 8–20 GiB gp3 is enough |

3. Under **Network settings** click **Edit** and create a **Security group** with these inbound rules:

   | Type | Port | Source | Why |
   |------|------|--------|-----|
   | SSH | 22 | **My IP** | so only *you* can log in |
   | HTTP | 80 | Anywhere (0.0.0.0/0) | website |
   | HTTPS | 443 | Anywhere (0.0.0.0/0) | website with SSL |

   > ⚠️ **Do not** open port 3000 to the internet. Users must go through Nginx.
   > Keeping 3000 closed is the point of the reverse proxy.

4. Click **Launch instance**.
5. Go to **Instances**, select your server, and copy its **Public IPv4 address**.
   This is `<YOUR_SERVER_IP>` in the rest of the guide.

✅ **Check:** the instance state is **Running** and the status checks show **2/2 checks passed**.

---

## 3. Connect to the server with SSH

SSH gives you a terminal on the remote server.

### On Windows (PowerShell)

Windows 10/11 has `ssh` built in. Move `crud-key.pem` to a folder such as
`C:\Users\<YOU>\.ssh\`, then fix its permissions (SSH refuses keys that other
users can read):

```powershell
$ icacls "$env:USERPROFILE\.ssh\crud-key.pem" /inheritance:r
$ icacls "$env:USERPROFILE\.ssh\crud-key.pem" /grant:r "$($env:USERNAME):(R)"
```

Connect:

```powershell
$ ssh -i "$env:USERPROFILE\.ssh\crud-key.pem" ubuntu@<YOUR_SERVER_IP>
```

### On macOS / Linux

```bash
$ chmod 400 ~/.ssh/crud-key.pem
$ ssh -i ~/.ssh/crud-key.pem ubuntu@<YOUR_SERVER_IP>
```

The first time, SSH asks *"Are you sure you want to continue connecting?"* →
type `yes`.

> The default user on Ubuntu AMIs is **`ubuntu`** (not `root`, not `ec2-user`).

✅ **Check:** your prompt changes to something like `ubuntu@ip-172-31-xx-xx:~$`.
From now on, **every command runs on the server** unless the guide says otherwise.

---

## 4. Update the server

Always update a new server before installing anything:

```bash
$ sudo apt update          # download the latest package list
$ sudo apt upgrade -y      # install updates
```

If you see a purple screen asking which services to restart, press **Enter** to accept the defaults.

Optional: set the timezone so log timestamps make sense to you:

```bash
$ sudo timedatectl set-timezone Asia/Phnom_Penh    # change to your timezone
$ timedatectl
```

If the upgrade installed a new kernel, reboot and SSH in again:

```bash
$ sudo reboot
```

---

## 5. Install Node.js and Git

Ubuntu's built-in `nodejs` package is often old, so install the current LTS
version from **NodeSource**:

```bash
$ curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
$ sudo apt install -y nodejs git
```

✅ **Check:**

```bash
$ node -v     # v22.x.x
$ npm -v      # 10.x.x
$ git --version
```

---

## 6. Get the code onto the server

We keep the app in the `ubuntu` user's home folder: `/home/ubuntu/full-crud-nodejs`.

```bash
$ cd ~
$ git clone https://github.com/radytrainer/full-crud-nodejs.git
$ cd full-crud-nodejs
$ ls
```

> **Using your own fork?** Replace the URL with your repo's URL. If the repo is
> private, GitHub will ask for a username and a **Personal Access Token** (not
> your password). Create one at GitHub → Settings → Developer settings →
> Personal access tokens.

Install the dependencies:

```bash
$ npm install
```

✅ **Check:** a `node_modules/` folder now exists (`ls`).

---

## 7. Run the app manually (first test)

Start the app by hand once to make sure it works on the server:

```bash
$ node server.js
```

You should see:

```
listening on port 3000
```

Port 3000 is closed to the internet (on purpose), so test it **from the server
itself**. Open a **second** SSH window to the server and run:

```bash
$ curl http://localhost:3000/api/users
```

You should get JSON back, like `{"success":true,"data":[...]}`.

Go back to the first window and press **Ctrl + C** to stop the app.

> ❓ **Why not just leave it running?** It stops as soon as you close the SSH
> window or the server reboots. We fix that with PM2 in [step 9](#9-keep-the-app-running-with-pm2).

---

## 8. The database

### 8.1 How this app stores data

This project **does not use MySQL, PostgreSQL or MongoDB**. The "database" is
two JSON files:

```
database/users.json
database/posts.json
```

Every create/update/delete rewrites the whole file using `fs.writeFileSync`.
This is great for learning, but it has consequences on a real server:

| Consequence | What to do |
|-------------|------------|
| Data lives **inside the project folder**. | Never delete the project folder to "redeploy". Back up `database/` first. |
| The files are **tracked by Git**. | `git pull` can conflict with data written on the server. See [step 14](#14-deploy-an-update). |
| The Node process must be able to **write** to the files. | The files must be owned by the user that runs PM2 (`ubuntu`). |
| If the EC2 instance is **terminated**, the data is gone. | Make backups (below). |

### 8.2 Check file permissions

```bash
$ cd ~/full-crud-nodejs
$ ls -l database/
```

The owner should be `ubuntu`. If it is `root` (for example because you ran a
command with `sudo` by mistake), fix it:

```bash
$ sudo chown -R ubuntu:ubuntu ~/full-crud-nodejs
```

### 8.3 Daily automatic backup with cron

Create a backup folder and a backup script:

```bash
$ mkdir -p ~/backups
$ nano ~/backup-db.sh
```

Paste this:

```bash
#!/bin/bash
# Copy the JSON database into a dated archive and keep the last 14 backups.
DATE=$(date +%Y-%m-%d_%H-%M)
tar -czf /home/ubuntu/backups/db_$DATE.tar.gz -C /home/ubuntu/full-crud-nodejs database
ls -1t /home/ubuntu/backups/db_*.tar.gz | tail -n +15 | xargs -r rm
```

Save in nano: **Ctrl + O**, **Enter**, then **Ctrl + X** to exit.

Make it executable and test it:

```bash
$ chmod +x ~/backup-db.sh
$ ~/backup-db.sh
$ ls ~/backups
```

Schedule it every day at 2:00 AM:

```bash
$ crontab -e
```

(If asked to pick an editor, choose `1` for nano.) Add this line at the bottom:

```
0 2 * * * /home/ubuntu/backup-db.sh
```

**Restore** a backup:

```bash
$ cd ~/full-crud-nodejs
$ tar -xzf ~/backups/db_<DATE>.tar.gz
$ pm2 restart crud-app      # the app reads the files only at startup
```

> 💡 **Download a backup to your laptop** (run this on *your laptop*, not the server):
> `scp -i <PATH_TO>/crud-key.pem ubuntu@<YOUR_SERVER_IP>:~/backups/db_<DATE>.tar.gz .`

### 8.4 (Optional practice) Install a real database: MySQL

This app does **not** use MySQL, so you can skip this. It is here so you can
practise installing a real database server, which you will need when you move
the app from JSON files to SQL.

```bash
$ sudo apt install -y mysql-server
$ sudo systemctl status mysql          # should say "active (running)"
$ sudo mysql_secure_installation       # answer the questions; say Y to remove test DB and anonymous users
```

Create a database and a dedicated user for the app (never let the app use `root`):

```bash
$ sudo mysql
```

```sql
CREATE DATABASE crud_app;
CREATE USER 'crud_user'@'localhost' IDENTIFIED BY '<A_STRONG_PASSWORD>';
GRANT ALL PRIVILEGES ON crud_app.* TO 'crud_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Test the new user:

```bash
$ mysql -u crud_user -p crud_app
```

> ⚠️ Do **not** open port 3306 in the Security Group. The app talks to MySQL on
> `localhost`, so the database never needs to be reachable from the internet.
>
> Back up MySQL with: `mysqldump -u crud_user -p crud_app > ~/backups/crud_app.sql`

---

## 9. Keep the app running with PM2

PM2 is a process manager for Node.js.

Install it globally:

```bash
$ sudo npm install -g pm2
```

Start the app. **Run this from inside the project folder**, because the app
uses relative paths to find `database/*.json`:

```bash
$ cd ~/full-crud-nodejs
$ pm2 start server.js --name crud-app
```

✅ **Check:**

```bash
$ pm2 status                         # crud-app should be "online"
$ curl http://localhost:3000/api/users
$ pm2 logs crud-app --lines 20       # press Ctrl + C to leave the log view
```

### Start PM2 automatically after a reboot

```bash
$ pm2 startup
```

PM2 prints a command that starts with `sudo env PATH=...`. **Copy that whole
line, paste it and run it.** Then save the current list of apps:

```bash
$ pm2 save
```

Test it for real:

```bash
$ sudo reboot
# wait ~1 minute, SSH in again, then:
$ pm2 status          # crud-app should be "online" again
```

---

## 10. Install and configure Nginx

### 10.1 Install

```bash
$ sudo apt install -y nginx
$ sudo systemctl enable nginx      # start on boot
$ sudo systemctl status nginx      # should be "active (running)"
```

✅ **Check:** open `http://<YOUR_SERVER_IP>` in your browser. You should see the
**"Welcome to nginx!"** page. If the page doesn't load, check that the Security
Group allows port 80 (step 2).

### 10.2 How Nginx config files are organised

| Path | Purpose |
|------|---------|
| `/etc/nginx/nginx.conf` | main config (rarely edited) |
| `/etc/nginx/sites-available/` | one file per website (**write configs here**) |
| `/etc/nginx/sites-enabled/` | shortcuts (symlinks) to the sites that are **turned on** |
| `/var/log/nginx/access.log` | every request |
| `/var/log/nginx/error.log` | errors (look here first when something breaks) |

### 10.3 Create the site config

```bash
$ sudo nano /etc/nginx/sites-available/crud-app
```

Paste this (replace `<YOUR_SERVER_IP>`, or your domain if you have one):

```nginx
server {
    listen 80;
    server_name <YOUR_SERVER_IP>;          # or: example.com www.example.com

    # Limit the size of request bodies (JSON from the forms)
    client_max_body_size 5M;

    location / {
        # Send every request to the Node.js app
        proxy_pass http://localhost:3000;

        # Pass the original request details to Node
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Needed for WebSockets (harmless if you don't use them)
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

What the important lines mean:

- `listen 80;`: Nginx listens for HTTP on port 80.
- `server_name`: which domain/IP this block answers for.
- `proxy_pass http://localhost:3000;`: forward the request to our Node app.
- `proxy_set_header ...`: without these, Node would think every request came from Nginx (`127.0.0.1`) instead of the real visitor.

### 10.4 Enable the site and disable the default page

```bash
$ sudo ln -s /etc/nginx/sites-available/crud-app /etc/nginx/sites-enabled/
$ sudo rm /etc/nginx/sites-enabled/default
```

### 10.5 Test the config, then reload

**Always** test before reloading. A typo can take the whole web server down.

```bash
$ sudo nginx -t
```

Expected:

```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

```bash
$ sudo systemctl reload nginx
```

✅ **Check:** open `http://<YOUR_SERVER_IP>` in your browser. You should now see
the **CRUD app** with the users and posts tables, not the Nginx welcome page.
Also try `http://<YOUR_SERVER_IP>/api/users`.

---

## 11. Turn on the firewall (UFW)

The AWS Security Group is the first wall. UFW is a second wall on the server
itself. Defense in depth.

> ⚠️ **Allow SSH BEFORE enabling the firewall**, or you will lock yourself out
> of the server.

```bash
$ sudo ufw allow OpenSSH
$ sudo ufw allow 'Nginx Full'      # ports 80 and 443
$ sudo ufw enable                  # type "y"
$ sudo ufw status
```

Expected:

```
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
Nginx Full                 ALLOW       Anywhere
...
```

Port 3000 is **not** in the list, which is correct. Only Nginx can reach Node.

✅ **Check:** `http://<YOUR_SERVER_IP>` still works, and
`http://<YOUR_SERVER_IP>:3000` does **not** load from your browser.

---

## 12. Domain name and Elastic IP (optional)

### Elastic IP: keep the same IP address

By default, the public IP **changes every time you stop and start** the
instance. To keep it fixed:

1. EC2 → **Elastic IPs** → **Allocate Elastic IP address** → **Allocate**.
2. Select it → **Actions** → **Associate Elastic IP address** → choose your instance → **Associate**.
3. Use this new IP from now on (update `server_name` in Nginx if you used the IP there).

> 💰 An Elastic IP may cost a small hourly fee. **Release** it when you finish
> the course (see [step 17](#17-clean-up-so-you-are-not-charged)).

### Point a domain to the server

At your domain registrar (Namecheap, GoDaddy, Cloudflare, Route 53, ...), add DNS records:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `<YOUR_ELASTIC_IP>` |
| A | `www` | `<YOUR_ELASTIC_IP>` |

DNS can take a few minutes to a few hours to update. Check with (on your laptop):

```bash
$ nslookup <YOUR_DOMAIN>
```

Then update Nginx:

```bash
$ sudo nano /etc/nginx/sites-available/crud-app
#   server_name <YOUR_DOMAIN> www.<YOUR_DOMAIN>;
$ sudo nginx -t && sudo systemctl reload nginx
```

---

## 13. HTTPS with Let's Encrypt (optional, needs a domain)

Let's Encrypt gives free SSL certificates. You **need a domain name** for
this. It does not work with a bare IP address.

```bash
$ sudo apt install -y certbot python3-certbot-nginx
$ sudo certbot --nginx -d <YOUR_DOMAIN> -d www.<YOUR_DOMAIN>
```

Certbot asks for your email and for you to accept the terms. It then edits your
Nginx config automatically to add HTTPS and redirect HTTP → HTTPS.

✅ **Check:**

- `https://<YOUR_DOMAIN>` loads with a padlock 🔒.
- `http://<YOUR_DOMAIN>` redirects to `https://`.
- Automatic renewal works:

  ```bash
  $ sudo certbot renew --dry-run
  ```

---

## 14. Deploy an update

You changed code on your laptop and pushed it to GitHub. To put it on the server:

```bash
$ cd ~/full-crud-nodejs

# 1. Back up the data first (always!)
$ ~/backup-db.sh

# 2. Get the new code
$ git pull

# 3. Install any new dependencies
$ npm install

# 4. Restart the app
$ pm2 restart crud-app

# 5. Check it
$ pm2 status
$ pm2 logs crud-app --lines 20
$ curl http://localhost:3000/api/users
```

### ⚠️ If `git pull` fails because of the database files

`database/users.json` and `database/posts.json` are tracked by Git, **and** the
server changes them whenever someone uses the app. So `git pull` may say:

```
error: Your local changes to the following files would be overwritten by merge:
        database/users.json
```

To keep the **server's** data and still get the new code:

```bash
$ cp database/*.json ~/backups/                 # 1. save the live data
$ git checkout -- database/                     # 2. throw away local changes in Git's eyes
$ git pull                                      # 3. pull the new code
$ cp ~/backups/users.json ~/backups/posts.json database/   # 4. put the live data back
$ pm2 restart crud-app
```

> 💡 **Discussion for class:** this is exactly why real apps keep data in a
> separate database (MySQL, PostgreSQL, MongoDB...) and **not** inside the code
> repository. Code and data should have separate lifecycles.

---

## 15. Troubleshooting

**Golden rule:** read the logs before guessing.

```bash
$ pm2 logs crud-app                          # Node app errors
$ sudo tail -n 50 /var/log/nginx/error.log   # Nginx errors
$ sudo systemctl status nginx
```

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| `Permission denied (publickey)` when SSH-ing | wrong key file, wrong user, or key permissions too open | use `ubuntu@...`, check the `-i` path, redo the `chmod 400` / `icacls` step |
| SSH **times out** | Security Group port 22 is locked to an old IP (your IP changed) | EC2 → Security Groups → edit inbound rule 22 → **My IP** |
| Browser **times out** on `http://<IP>` | port 80 not open in Security Group or UFW | check both (steps 2 and 11) |
| **"Welcome to nginx!"** instead of the app | default site still enabled | `sudo rm /etc/nginx/sites-enabled/default` → `sudo nginx -t` → reload |
| **502 Bad Gateway** | Nginx is fine but Node is **not running** | `pm2 status`, `pm2 logs crud-app`, then `pm2 restart crud-app` |
| `ENOENT: no such file or directory, open './database/users.json'` | PM2 started from the wrong folder | `pm2 delete crud-app` → `cd ~/full-crud-nodejs` → `pm2 start server.js --name crud-app` → `pm2 save` |
| `EADDRINUSE: address already in use :::3000` | another copy of the app is already running (maybe a forgotten `node server.js`) | `sudo lsof -i :3000` → `kill <PID>`, or `pm2 delete all` and start again |
| `EACCES: permission denied` writing JSON | files owned by root | `sudo chown -R ubuntu:ubuntu ~/full-crud-nodejs` |
| `sudo nginx -t` fails | typo in config (missing `;` or `}`) | read the line number in the error and fix the file |
| App doesn't come back after reboot | `pm2 startup` / `pm2 save` not done | redo the end of step 9 |
| Site worked yesterday, today the IP is different | instance was stopped/started without an Elastic IP | use the new IP or set up an Elastic IP (step 12) |

---

## 16. Command cheat sheet

```bash
# ---- PM2 (Node app) ----
pm2 status                    # list apps
pm2 logs crud-app             # live logs (Ctrl+C to exit)
pm2 restart crud-app          # restart after code change
pm2 stop crud-app             # stop
pm2 delete crud-app           # remove from PM2
pm2 monit                     # live CPU/RAM dashboard
pm2 save                      # remember current apps for reboot

# ---- Nginx ----
sudo nginx -t                 # test config (ALWAYS before reload)
sudo systemctl reload nginx   # apply config changes
sudo systemctl restart nginx  # full restart
sudo systemctl status nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# ---- Firewall ----
sudo ufw status
sudo ufw allow <PORT>

# ---- System ----
df -h                         # disk space
free -h                       # memory
htop                          # processes (q to quit; install with: sudo apt install htop)
sudo lsof -i :3000            # what is using port 3000
sudo reboot

# ---- Copy files between laptop and server (run on laptop) ----
scp -i crud-key.pem localfile.txt ubuntu@<IP>:~/
scp -i crud-key.pem ubuntu@<IP>:~/remotefile.txt .
```

---

## 17. Clean up so you are not charged

When the course or the exercise is finished:

1. **Download your backups** to your laptop (see step 8.3).
2. EC2 → **Instances** → select the server → **Instance state** → **Terminate instance**.
   (Stopping stops compute charges, but storage still costs a little. Terminate deletes everything.)
3. EC2 → **Elastic IPs** → select → **Actions** → **Release Elastic IP address**.
4. Delete unused **Volumes** and **Snapshots** if any remain.
5. Check **Billing → Bills** a few days later to make sure nothing is still running.

---

## 18. Final checklist

Tick each one before you say "deployed ✅":

- [ ] EC2 Ubuntu instance running; SSH works with the `.pem` key
- [ ] Security Group: 22 (My IP), 80, 443 open; **3000 closed**
- [ ] Server updated (`apt update && apt upgrade`)
- [ ] Node.js LTS and Git installed
- [ ] Code cloned to `~/full-crud-nodejs`, `npm install` done
- [ ] `database/` files owned by `ubuntu`, daily backup cron in place
- [ ] App running in PM2 as `crud-app`, `pm2 startup` + `pm2 save` done
- [ ] App comes back automatically after `sudo reboot`
- [ ] Nginx reverse proxy config in `sites-available/crud-app`, enabled, default removed
- [ ] `sudo nginx -t` passes
- [ ] UFW enabled: OpenSSH + Nginx Full
- [ ] `http://<YOUR_SERVER_IP>` shows the app and `/api/users` returns JSON
- [ ] (Optional) Domain points to Elastic IP
- [ ] (Optional) HTTPS works and `certbot renew --dry-run` passes

---

### Exercises for students

1. Add a new user from the browser, then SSH in and run `cat database/users.json`. Can you see your user?
2. Stop the app with `pm2 stop crud-app` and reload the browser. What error do you get, and why? Which log tells you?
3. Change the welcome title in `public/index.html`, push to GitHub, and deploy it with the steps in section 14.
4. Break the Nginx config on purpose (delete a `;`), run `sudo nginx -t`, and read the error message.
5. Restore yesterday's backup of the database.
6. **Challenge:** move the data from JSON files into the MySQL database from step 8.4.
