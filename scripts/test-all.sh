#!/bin/bash

# Test runner script for Notari
# Runs both backend (Rust) and frontend (TypeScript) tests

set -e  # Exit on error

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                         NOTARI TEST SUITE                                    ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BACKEND_PASSED=0
FRONTEND_PASSED=0

# Backend tests
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "🦀 Running Backend Tests (Rust)"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

cd src-tauri
if cargo test; then
    echo ""
    echo -e "${GREEN}✅ Backend tests passed${NC}"
    BACKEND_PASSED=1
else
    echo ""
    echo -e "${RED}❌ Backend tests failed${NC}"
fi
cd ..

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "⚛️  Running Frontend Tests (TypeScript/React)"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

if pnpm test --run; then
    echo ""
    echo -e "${GREEN}✅ Frontend tests passed${NC}"
    FRONTEND_PASSED=1
else
    echo ""
    echo -e "${RED}❌ Frontend tests failed${NC}"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "📊 Test Summary"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

if [ $BACKEND_PASSED -eq 1 ]; then
    echo -e "Backend:  ${GREEN}✅ PASSED${NC}"
else
    echo -e "Backend:  ${RED}❌ FAILED${NC}"
fi

if [ $FRONTEND_PASSED -eq 1 ]; then
    echo -e "Frontend: ${GREEN}✅ PASSED${NC}"
else
    echo -e "Frontend: ${RED}❌ FAILED${NC}"
fi

echo ""

# Exit with error if any tests failed
if [ $BACKEND_PASSED -eq 1 ] && [ $FRONTEND_PASSED -eq 1 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}💥 Some tests failed${NC}"
    exit 1
fi

