# Quick Start Guide

## 🚀 First Time Setup (5 minutes)

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd personal-website

# Install frontend dependencies
cd client && npm install && cd ..

# Install backend dependencies (optional - Railway handles this)
cd server && mvn clean install && cd ..
```

### 2. Configure Local Environment

#### Backend (required for local development)
```bash
cd server/src/main/resources
cp application-local.properties.example application-local.properties
```

Edit `application-local.properties`:
```properties
spring.datasource.url=jdbc:postgresql://your-railway-host:port/railway
spring.datasource.username=postgres
spring.datasource.password=YOUR_RAILWAY_PASSWORD_HERE
cors.allowed.origins=http://localhost:3000
chess.username=shia_justdoit
```

#### Frontend (required for local development)
```bash
cd client
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local
```

### 3. Run Locally
```bash
# Terminal 1: Backend
cd server
mvn spring-boot:run -Dspring-boot.run.profiles=local

# Terminal 2: Frontend
cd client
npm run dev
```

Visit: http://localhost:3000

---

## 🔒 Security Checklist

Before pushing to GitHub:

```bash
# These should return "✓ is gitignored"
git check-ignore server/src/main/resources/application-local.properties
git check-ignore client/.env.local

# These should NOT show the credential files
git status
```

**Files that should NEVER be committed:**
- ❌ `server/src/main/resources/application-local.properties`
- ❌ `client/.env.local`
- ❌ Any file with passwords or API keys

**Files that SHOULD be committed:**
- ✅ `server/src/main/resources/application.properties` (has placeholders only)
- ✅ `server/src/main/resources/application-local.properties.example` (template)
- ✅ `.gitignore`

---

## 🌐 Production Deployment

### Railway (Backend)
1. Push to GitHub `main` branch
2. Railway auto-deploys
3. Set environment variables in Railway dashboard:
   - `SPRING_DATASOURCE_URL`
   - `SPRING_DATASOURCE_USERNAME`
   - `SPRING_DATASOURCE_PASSWORD`
   - `CORS_ALLOWED_ORIGINS` (your Vercel URL)
   - `CHESS_USERNAME`

### Vercel (Frontend)
1. Push to GitHub `main` branch
2. Vercel auto-deploys
3. Set environment variable in Vercel dashboard:
   - `NEXT_PUBLIC_API_URL` = Your Railway backend URL

---

## 🐛 Troubleshooting

### "Access denied for user" error
- Check `application-local.properties` has correct Railway credentials
- Verify you're running with: `mvn spring-boot:run -Dspring-boot.run.profiles=local`

### Frontend can't connect to backend
- Check `.env.local` exists with correct API URL
- Verify backend is running on port 8080
- Check CORS settings in `application-local.properties`

### Changes not reflected in production
- Check GitHub Actions / Railway logs for deployment errors
- Verify environment variables are set in Railway/Vercel dashboards
- Try manual redeploy from Railway/Vercel dashboard

---

## 📚 More Information

- **Detailed Deployment**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Project Architecture**: See [CLAUDE.md](./CLAUDE.md)
- **API Documentation**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
