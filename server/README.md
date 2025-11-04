# Coding Stats Backend

Spring Boot REST API for tracking Chess.com statistics and serving coding problem solutions.

## Features

- 🎯 Chess.com API Integration
- 📊 Daily Rating Tracking
- 📈 Historical Data Analysis
- 🔄 Automated Daily Updates
- 🚀 RESTful API

## Tech Stack

- **Java 17**
- **Spring Boot 3.2.0**
- **PostgreSQL** (Railway)
- **Spring Data JPA**
- **Spring Scheduler**

## Prerequisites

- Java 17 or higher
- Maven 3.6+
- PostgreSQL (or Railway account)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/bdvitz/coding-stats-backend.git
cd coding-stats-backend
```

### 2. Configure Database

Create a PostgreSQL database or use Railway. Update `application.properties`:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/codingstats
spring.datasource.username=your_username
spring.datasource.password=your_password
chess.username=your_chess_username
```

### 3. Run Locally

```bash
mvn clean install
mvn spring-boot:run
```

The API will start on `http://localhost:8080`

## API Endpoints

### Chess Statistics

#### Get Current Stats
```http
GET /api/chess/stats/current?username=bdvitz
```

#### Refresh Stats from Chess.com
```http
POST /api/chess/stats/refresh?username=bdvitz
```

#### Get Rating History
```http
GET /api/chess/stats/history?username=bdvitz&days=30
```

#### Get All Rating History
```http
GET /api/chess/stats/history/all?username=bdvitz
```

#### Get Chart Data
```http
GET /api/chess/stats/ratings-over-time?username=bdvitz&days=90
```

#### Health Check
```http
GET /api/chess/stats/health
```

## Environment Variables

For deployment (Railway/Heroku/etc.):

```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://host:port/database
SPRING_DATASOURCE_USERNAME=username
SPRING_DATASOURCE_PASSWORD=password
CHESS_USERNAME=your_chess_username
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
PORT=8080
```

## Scheduled Tasks

The application automatically fetches chess statistics daily at midnight UTC using Spring's `@Scheduled` annotation:

```java
@Scheduled(cron = "0 0 0 * * *") // Every day at 00:00:00 UTC
public void fetchDailyChessStats()
```

## Database Schema

### chess_stats
```sql
CREATE TABLE chess_stats (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    rapid_rating INT,
    blitz_rating INT,
    bullet_rating INT,
    puzzle_rating INT,
    total_games INT,
    wins INT,
    losses INT,
    draws INT,
    last_updated TIMESTAMP
);
```

### daily_ratings
```sql
CREATE TABLE daily_ratings (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    rapid_rating INT,
    blitz_rating INT,
    bullet_rating INT,
    puzzle_rating INT,
    UNIQUE(username, date)
);
```

## Deployment

### Railway

1. Create a new Railway project
2. Add PostgreSQL service
3. Connect your GitHub repository
4. Set environment variables
5. Deploy!

Railway will automatically:
- Detect the Maven project
- Build using `mvn clean package`
- Run the JAR file
- Provide a public URL

### Manual Deployment

```bash
# Build JAR
mvn clean package -DskipTests

# Run JAR
java -jar target/coding-stats-backend-1.0.0.jar
```

## Testing

```bash
# Run all tests
mvn test

# Run with coverage
mvn test jacoco:report
```

## Project Structure

```
src/main/java/com/bdvitz/codingstats/
├── CodingStatsApplication.java
├── config/
│   └── WebConfig.java              # CORS configuration
├── controller/
│   └── ChessStatsController.java   # REST endpoints
├── model/
│   ├── ChessStat.java              # Current stats entity
│   └── DailyRating.java            # Historical data entity
├── repository/
│   ├── ChessStatRepository.java
│   └── DailyRatingRepository.java
├── scheduler/
│   └── ChessStatsScheduler.java    # Daily cron job
└── service/
    ├── ChessStatsService.java      # Business logic
    └── ChessComApiService.java     # Chess.com API client
```

## Development

### Run in Development Mode

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

### Enable Debug Logging

In `application.properties`:
```properties
logging.level.com.bdvitz.codingstats=DEBUG
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License

## Author

**bdvitz**
- GitHub: [@bdvitz](https://github.com/bdvitz)
- Chess.com: [bdvitz](https://chess.com/member/bdvitz)
