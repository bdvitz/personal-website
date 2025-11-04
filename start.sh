#!/bin/bash

# Personal Website - Quick Start Script
# Monorepo version with client and server

echo "🚀 Personal Website - Quick Start"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

# Check if in correct directory
if [ ! -d "client" ] || [ ! -d "server" ]; then
    print_error "Please run this script from the personal-website root directory"
    print_info "Expected structure: personal-website/{client,server}"
    exit 1
fi

print_info "Checking prerequisites..."

# Check Java
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
    if [ "$JAVA_VERSION" -ge 17 ]; then
        print_success "Java 17+ found"
    else
        print_error "Java 17+ required (found Java $JAVA_VERSION)"
        exit 1
    fi
else
    print_error "Java not found. Please install Java 17+"
    exit 1
fi

# Check Maven
if command -v mvn &> /dev/null; then
    print_success "Maven found"
else
    print_error "Maven not found. Please install Maven 3.6+"
    exit 1
fi

# Check Node
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        print_success "Node.js 18+ found"
    else
        print_error "Node.js 18+ required (found Node.js $NODE_VERSION)"
        exit 1
    fi
else
    print_error "Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check PostgreSQL
if command -v psql &> /dev/null; then
    print_success "PostgreSQL found"
else
    print_warning "PostgreSQL not found - you'll need Docker or remote database"
fi

echo ""
echo "================================"
echo ""

# Menu
echo "What would you like to do?"
echo "1) Setup and run everything (first time)"
echo "2) Run backend only"
echo "3) Run frontend only"
echo "4) Run both (already configured)"
echo "5) Clean and rebuild"
echo "6) Exit"
echo ""
read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        print_info "Setting up monorepo..."
        
        # Setup Server
        print_info "Setting up server..."
        cd server
        
        if [ ! -f "src/main/resources/application.properties" ]; then
            print_error "application.properties not found"
            exit 1
        fi
        
        print_info "Installing backend dependencies..."
        mvn clean install -DskipTests
        
        if [ $? -eq 0 ]; then
            print_success "Backend setup complete"
        else
            print_error "Backend setup failed"
            exit 1
        fi
        
        cd ..
        
        # Setup Client
        print_info "Setting up client..."
        cd client
        
        print_info "Installing frontend dependencies..."
        npm install
        
        if [ $? -eq 0 ]; then
            print_success "Frontend setup complete"
        else
            print_error "Frontend setup failed"
            exit 1
        fi
        
        # Create .env.local if needed
        if [ ! -f ".env.local" ]; then
            echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local
            print_success "Created .env.local"
        fi
        
        cd ..
        
        print_success "Setup complete!"
        print_info "Starting both applications..."
        
        # Start backend in background
        print_info "Starting backend on http://localhost:8080..."
        cd server
        mvn spring-boot:run > ../server.log 2>&1 &
        SERVER_PID=$!
        cd ..
        
        sleep 5
        
        # Start frontend
        print_info "Starting frontend on http://localhost:3000..."
        cd client
        npm run dev
        
        # Cleanup
        kill $SERVER_PID 2>/dev/null
        ;;
        
    2)
        print_info "Starting backend..."
        cd server
        print_info "Backend running on http://localhost:8080"
        print_info "Health check: http://localhost:8080/api/chess/stats/health"
        mvn spring-boot:run
        ;;
        
    3)
        print_info "Starting frontend..."
        cd client
        
        if [ ! -f ".env.local" ]; then
            print_info "Creating .env.local..."
            echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local
        fi
        
        print_info "Frontend running on http://localhost:3000"
        print_warning "Make sure backend is running on http://localhost:8080"
        npm run dev
        ;;
        
    4)
        print_info "Starting both applications..."
        
        # Start backend
        print_info "Starting backend on http://localhost:8080..."
        cd server
        mvn spring-boot:run > ../server.log 2>&1 &
        SERVER_PID=$!
        cd ..
        
        sleep 5
        
        # Start frontend
        print_info "Starting frontend on http://localhost:3000..."
        cd client
        npm run dev
        
        # Cleanup
        kill $SERVER_PID 2>/dev/null
        ;;
        
    5)
        print_info "Cleaning and rebuilding..."
        
        # Clean backend
        print_info "Cleaning backend..."
        cd server
        mvn clean
        cd ..
        
        # Clean frontend
        print_info "Cleaning frontend..."
        cd client
        rm -rf .next node_modules
        cd ..
        
        print_success "Clean complete!"
        print_info "Run option 1 to rebuild everything"
        ;;
        
    6)
        print_info "Exiting..."
        exit 0
        ;;
        
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
print_success "Done!"
