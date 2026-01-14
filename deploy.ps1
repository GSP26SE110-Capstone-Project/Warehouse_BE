# PowerShell script để deploy Docker
Write-Host "=== Smart Warehouse Docker Deploy ===" -ForegroundColor Cyan

# Kiểm tra Docker
Write-Host "`n[1/4] Kiểm tra Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    $composeVersion = docker-compose --version
    Write-Host "✓ Docker: $dockerVersion" -ForegroundColor Green
    Write-Host "✓ Docker Compose: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker chưa được cài đặt hoặc chưa chạy!" -ForegroundColor Red
    exit 1
}

# Dừng containers cũ (nếu có)
Write-Host "`n[2/4] Dừng containers cũ..." -ForegroundColor Yellow
docker-compose down

# Build và start containers
Write-Host "`n[3/4] Build và start containers..." -ForegroundColor Yellow
docker-compose up -d --build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Containers đã được khởi động!" -ForegroundColor Green
    
    # Chờ một chút để containers khởi động
    Start-Sleep -Seconds 3
    
    # Kiểm tra status
    Write-Host "`n[4/4] Kiểm tra status containers..." -ForegroundColor Yellow
    docker-compose ps
    
    Write-Host "`n=== Deploy thành công! ===" -ForegroundColor Green
    Write-Host "API Server: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "Health Check: http://localhost:3000/health" -ForegroundColor Cyan
    Write-Host "`nĐể xem logs: docker-compose logs -f" -ForegroundColor Yellow
} else {
    Write-Host "✗ Có lỗi xảy ra khi deploy!" -ForegroundColor Red
    Write-Host "Kiểm tra logs: docker-compose logs" -ForegroundColor Yellow
    exit 1
}

