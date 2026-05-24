#!/bin/bash
# InterviewAI Setup Script

echo "🎙️  Setting up InterviewAI..."

# Install backend
echo "\n📦 Installing backend dependencies..."
cd backend && npm install

# Create .env from example
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created backend/.env — please fill in your credentials"
fi

# Install frontend
echo "\n📦 Installing frontend dependencies..."
cd ../frontend && npm install

# Create .env from example
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created frontend/.env"
fi

echo "\n✅ Setup complete!"
echo "\nNext steps:"
echo "1. Edit backend/.env — add MONGODB_URI, JWT_SECRET, GEMINI_API_KEY"
echo "2. Run: cd backend && npm run dev"
echo "3. Run: cd frontend && npm run dev"
echo "4. Open: http://localhost:5173"
