#!/bin/bash
# Start the LiDAR API backend server

echo "🚀 Starting LiDAR API Backend..."
echo "📁 Backend will be available at: http://127.0.0.1:8000"
echo "📚 API docs will be available at: http://127.0.0.1:8000/docs"
echo ""

cd backend
uv run python run_server.py