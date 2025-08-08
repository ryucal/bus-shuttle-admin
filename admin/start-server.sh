#!/bin/bash

echo "🚌 버스 셔틀 관리자 웹 페이지 서버를 시작합니다..."
echo ""

# Python 3가 설치되어 있는지 확인
if command -v python3 &> /dev/null; then
    echo "✅ Python 3를 사용하여 서버를 시작합니다."
    echo "🌐 브라우저에서 http://localhost:8000/admin/ 으로 접속하세요."
    echo "🛑 서버를 중지하려면 Ctrl+C를 누르세요."
    echo ""
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "✅ Python을 사용하여 서버를 시작합니다."
    echo "🌐 브라우저에서 http://localhost:8000/admin/ 으로 접속하세요."
    echo "🛑 서버를 중지하려면 Ctrl+C를 누르세요."
    echo ""
    python -m http.server 8000
elif command -v node &> /dev/null; then
    echo "✅ Node.js를 사용하여 서버를 시작합니다."
    echo "🌐 브라우저에서 http://localhost:8000/admin/ 으로 접속하세요."
    echo "🛑 서버를 중지하려면 Ctrl+C를 누르세요."
    echo ""
    npx serve . -p 8000
elif command -v php &> /dev/null; then
    echo "✅ PHP를 사용하여 서버를 시작합니다."
    echo "🌐 브라우저에서 http://localhost:8000/admin/ 으로 접속하세요."
    echo "🛑 서버를 중지하려면 Ctrl+C를 누르세요."
    echo ""
    php -S localhost:8000
else
    echo "❌ Python, Node.js, PHP 중 하나가 설치되어 있어야 합니다."
    echo "다음 중 하나를 설치해주세요:"
    echo "  - Python 3: https://www.python.org/downloads/"
    echo "  - Node.js: https://nodejs.org/"
    echo "  - PHP: https://www.php.net/downloads"
    exit 1
fi 