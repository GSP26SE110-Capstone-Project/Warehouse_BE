#!/bin/bash

# Bash script để deploy Docker
echo "=== Smart Warehouse Docker Deploy ==="

# Kiểm tra Docker
echo ""
echo "[1/4] Kiểm tra Docker..."
if ! command -v docker &> /dev/null; then
    echo "✗ Docker chưa được cài đặt!"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "✗ Docker Compose chưa được cài đặt!"
    exit 1
fi

echo "✓ Docker: $(docker --version)"
echo "✓ Docker Compose: $(docker-compose --version)"

# Dừng containers cũ (nếu có)
echo ""
echo "[2/4] Dừng containers cũ..."
docker-compose down

# Build và start containers
echo ""
echo "[3/4] Build và start containers..."
docker-compose up -d --build

if [ $? -eq 0 ]; then
    echo "✓ Containers đã được khởi động!"
    
    # Chờ một chút để containers khởi động
    sleep 3
    
    # Kiểm tra status
    echo ""
    echo "[4/4] Kiểm tra status containers..."
    docker-compose ps
    
    echo ""
    echo "=== Deploy thành công! ==="
    echo "API Server: http://localhost:3000"
    echo "Health Check: http://localhost:3000/health"
    echo ""
    echo "Để xem logs: docker-compose logs -f"
else
    echo "✗ Có lỗi xảy ra khi deploy!"
    echo "Kiểm tra logs: docker-compose logs"
    exit 1
fi

