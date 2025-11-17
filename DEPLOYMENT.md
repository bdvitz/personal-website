# Deployment Guide

This guide explains how to deploy your personal website with secure database credentials that are NOT committed to Git.

## Table of Contents
1. [Environment Variables Strategy](#environment-variables-strategy)
2. [Local Development Setup](#local-development-setup)
3. [Production Deployment](#production-deployment)
4. [Security Best Practices](#security-best-practices)

---

## Environment Variables Strategy

### Backend (Spring Boot)
The backend uses **Spring profiles** to manage different environments:

- `application.properties` - **COMMITTED TO GIT** - Contains environment variable placeholders
- `application-local.properties` - **NOT COMMITTED** - Your local development credentials
- `application-debug.properties` - **COMMITTED TO GIT** - Debug logging settings

### Frontend (Next.js)
The frontend uses `.env` files:

- `.env.local` - **NOT COMMITTED** - Local development API URLs
- `.env.production` - **NOT COMMITTED** - Production API URLs

---

## Local Development Setup

### Step 1: Backend Configuration

1. **Copy the example configuration:**
   ```bash
   cd server/src/main/resources
   cp application-local.properties.example application-local.properties
   ```

2. **Edit `application-local.properties` with your Railway credentials:**
   ```properties
   # Railway PostgreSQL Database
   spring.datasource.url=jdbc:postgresql://switchback.proxy.rlwy.net:46670/railway
   spring.datasource.username=postgres
   spring.datasource.password=uDEqIUNymTgMZDnFfnCujOTfEXTKQEiB

   # CORS for local development
   cors.allowed.origins=http://localhost:3000,http://localhost:3001

   # Chess.com username
   chess.username=shia_justdoit
   ```

3. **Run the backend with the local profile:**
   ```bash
   cd server
   mvn spring-boot:run -Dspring-boot.run.profiles=local
   ```

### Step 2: Frontend Configuration

1. **Create `.env.local` in the client directory:**
   ```bash
   cd client
   touch .env.local
   ```

2. **Add your local API URL:**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```

3. **Start the frontend:**
   ```bash
   npm run dev
   ```

---

## Production Deployment

### Backend Deployment (Railway)

Railway automatically injects environment variables. You have two options:

#### Option 1: Railway Environment Variables (Recommended)

1. **Go to your Railway project dashboard**
2. **Click on your Spring Boot service**
3. **Go to "Variables" tab**
4. **Add these variables:**
   ```
   SPRING_DATASOURCE_URL=jdbc:postgresql://your-railway-host:port/railway
   SPRING_DATASOURCE_USERNAME=postgres
   SPRING_DATASOURCE_PASSWORD=your-generated-password
   CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
   CHESS_USERNAME=shia_justdoit
   PORT=8080
   ```

5. **Railway will automatically use these** because `application.properties` has:
   ```properties
   spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/codingstats}
   spring.datasource.username=${SPRING_DATASOURCE_USERNAME:postgres}
   spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:postgres}
   cors.allowed.origins=${CORS_ALLOWED_ORIGINS:http://localhost:3000}
   chess.username=${CHESS_USERNAME:shia_justdoit}
   ```

#### Option 2: Link Railway PostgreSQL Service

If you created a PostgreSQL service in Railway:

1. **Link the database to your Spring Boot service**
2. **Railway automatically provides:**
   - `DATABASE_URL` (Postgres connection string)
   - `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

3. **Update `application.properties` to use Railway's variables:**
   ```properties
   spring.datasource.url=${DATABASE_URL:jdbc:postgresql://localhost:5432/codingstats}
   ```

### Frontend Deployment (Vercel)

1. **Go to your Vercel project settings**
2. **Add environment variables:**
   - **Variable**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://your-railway-app.railway.app` (your Railway backend URL)

3. **Redeploy** to apply the new environment variable

---

## Security Best Practices

### ✅ DO:
- Use environment variables for ALL sensitive data
- Keep `.env.local` and `application-local.properties` in `.gitignore`
- Use different credentials for development and production
- Rotate passwords regularly
- Use Railway's built-in PostgreSQL service for automatic credential management

### ❌ DON'T:
- Never commit `application-local.properties` or `.env.local`
- Never hardcode credentials in source files
- Never share production credentials in team chats
- Never use production credentials in development

---

## Verification Checklist

Before deploying, verify:

- [ ] `.gitignore` includes:
  ```
  .env
  .env.local
  .env.development.local
  .env.production.local
  application-local.properties
  **/application-local.properties
  ```

- [ ] `application-local.properties` is NOT in Git:
  ```bash
  git status server/src/main/resources/application-local.properties
  # Should show: "fatal: pathspec 'application-local.properties' did not match any files"
  ```

- [ ] `.env.local` is NOT in Git:
  ```bash
  git status client/.env.local
  # Should show: "fatal: pathspec '.env.local' did not match any files"
  ```

- [ ] Railway environment variables are set
- [ ] Vercel environment variables are set
- [ ] Application works in production

---

## Troubleshooting

### Backend can't connect to database

**Local Development:**
- Check `application-local.properties` exists and has correct Railway credentials
- Run with: `mvn spring-boot:run -Dspring-boot.run.profiles=local`

**Production (Railway):**
- Verify environment variables are set in Railway dashboard
- Check Railway logs: `railway logs`
- Ensure PostgreSQL service is running and linked

### Frontend can't reach backend

**Local Development:**
- Verify `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8080`
- Check backend is running on port 8080

**Production (Vercel):**
- Verify `NEXT_PUBLIC_API_URL` points to your Railway backend
- Check CORS settings allow your Vercel domain
- Verify Railway backend is deployed and accessible

### "Access Denied" or Authentication Errors

- Check database username/password are correct
- Verify Railway PostgreSQL service is accessible
- Check Railway service logs for connection errors

---

## Quick Reference

### Running Locally with Railway Database

```bash
# Terminal 1: Backend
cd server
mvn spring-boot:run -Dspring-boot.run.profiles=local

# Terminal 2: Frontend
cd client
npm run dev
```

### Deploying to Production

```bash
# Push to GitHub
git add .
git commit -m "Your changes"
git push origin main

# Railway auto-deploys from main branch
# Vercel auto-deploys from main branch
```

### Checking Git Ignored Files

```bash
# These commands should show "not tracked by git"
git check-ignore server/src/main/resources/application-local.properties
git check-ignore client/.env.local
```
