#!/bin/bash

# Saga Architect - Smoke Test Script
# Quick smoke tests for basic functionality
# Part of Bobby's World / Blue Phoenix OS ecosystem

set -e  # Exit on error

echo "========================================"
echo "Saga Architect - Smoke Tests"
echo "Package ID: com.bobbysworld.sagaarchitect"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo -n "  ✓ $test_name... "
    TESTS_RUN=$((TESTS_RUN + 1))

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "🔍 Running Smoke Tests..."
echo ""

# Test 1: Critical files exist
echo "Test Group 1: Critical Files"
run_test "package.json exists" "test -f package.json"
run_test "app.metadata.json exists" "test -f app.metadata.json"
run_test "README.md exists" "test -f README.md"
run_test "Types definition exists" "test -f src/lib/types.ts"
run_test "Storage module exists" "test -f src/lib/storage.ts"
run_test "Lore engine exists" "test -f src/lib/lore-engine.ts"
echo ""

# Test 2: Documentation exists
echo "Test Group 2: Documentation"
run_test "PRD exists" "test -f docs/PRD.md"
run_test "Roadmap exists" "test -f docs/ROADMAP.md"
run_test "Release checklist exists" "test -f docs/RELEASE_CHECKLIST.md"
run_test "Worldbuilding model exists" "test -f docs/WORLDBUILDING_MODEL.md"
run_test "Canon tracking exists" "test -f docs/CANON_TRACKING.md"
echo ""

# Test 3: TypeScript compilation
echo "Test Group 3: TypeScript"
run_test "TypeScript config valid" "test -f tsconfig.json"
run_test "Types file is valid TypeScript" "npx tsc --noEmit src/lib/types.ts"
echo ""

# Test 4: Package metadata
echo "Test Group 4: Package Metadata"

# Check package ID
if test -f app.metadata.json && grep -q "com.bobbysworld.sagaarchitect" app.metadata.json; then
    echo -e "  ✓ Package ID is correct... ${GREEN}PASS${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "  ✓ Package ID is correct... ${RED}FAIL${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Check app name
if test -f app.metadata.json && grep -q '"name".*"Saga Architect"' app.metadata.json; then
    echo -e "  ✓ App name is 'Saga Architect'... ${GREEN}PASS${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "  ✓ App name is 'Saga Architect'... ${RED}FAIL${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Check version format
if test -f app.metadata.json && grep -q '"version".*"[0-9]\+\.[0-9]\+\.[0-9]\+"' app.metadata.json; then
    echo -e "  ✓ Version format is valid... ${GREEN}PASS${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "  ✓ Version format is valid... ${RED}FAIL${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# Test 5: Scripts exist
echo "Test Group 5: Scripts"
run_test "healthcheck.sh exists" "test -f scripts/healthcheck.sh"
run_test "healthcheck.sh is executable" "test -x scripts/healthcheck.sh"
run_test "smoke-test.sh exists" "test -f scripts/smoke-test.sh"
run_test "smoke-test.sh is executable" "test -x scripts/smoke-test.sh"
echo ""

# Test 6: API routes exist
echo "Test Group 6: API Routes"
run_test "Universe API route exists" "test -f src/app/api/universes/route.ts"
run_test "Generate universe route exists" "test -f src/app/api/generate/universe/route.ts"
run_test "Generate characters route exists" "test -f src/app/api/generate/characters/route.ts"
run_test "Canon block API exists" "test -f src/app/api/lore-engine/canon-block/route.ts"
echo ""

# Test 7: Component structure
echo "Test Group 7: Components"
run_test "Components directory exists" "test -d src/components"
run_test "App directory exists" "test -d src/app"
run_test "Lib directory exists" "test -d src/lib"
echo ""

echo "========================================"
echo "Smoke Test Summary"
echo "========================================"
echo "Tests Run:    $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
else
    echo -e "Tests Failed: ${GREEN}0${NC}"
fi
echo "========================================"

# Exit with appropriate code
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}❌ Smoke tests FAILED${NC}"
    echo ""
    echo "One or more smoke tests failed. Please review the output above."
    exit 1
else
    echo -e "${GREEN}✅ All smoke tests PASSED${NC}"
    echo ""
    echo "Saga Architect is ready for basic usage."
    exit 0
fi
