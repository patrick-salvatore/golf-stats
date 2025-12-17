#!/bin/bash
# Start both backend and frontend servers

echo "🚀 Starting LiDAR Visualizer..."
echo ""
echo "This will start both the Python backend and SolidJS frontend."
echo "Backend: http://127.0.0.1:8000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Start backend in background
echo "📡 Starting backend..."
(cd backend && uv run python run_server.py) &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🌐 Starting frontend..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

# Trap Ctrl+C
trap cleanup INT

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID