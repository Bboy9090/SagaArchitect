#!/bin/bash

# Phoenix Creator Studio - Smoke Test Script
# Quick smoke tests for basic functionality
# Canonical repository: Bboy9090/SagaArchitect

set -e

echo "========================================"
echo "Phoenix Creator Studio - Smoke Tests"
echo "Package ID: com.bobbysworld.phoenixcreatorstudio"
echo "========================================"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

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

echo "Test Group 1: Critical Files"
run_test "package.json exists" "test -f package.json"
run_test "app.metadata.json exists" "test -f app.metadata.json"
run_test "README.md exists" "test -f README.md"
run_test "Types definition exists" "test -f src/lib/types.ts"
run_test "Storage module exists" "test -f src/lib/storage.ts"
run_test "Lore engine exists" "test -f src/lib/lore-engine.ts"
echo ""

echo "Test Group 2: Documentation"
run_test "PRD exists" "test -f docs/PRD.md"
run_test "Roadmap exists" "test -f docs/ROADMAP.md"
run_test "Release checklist exists" "test -f docs/RELEASE_CHECKLIST.md"
run_test "Worldbuilding model exists" "test -f docs/WORLDBUILDING_MODEL.md"
run_test "Canon tracking exists" "test -f docs/CANON_TRACKING.md"
echo ""

echo "Test Group 3: TypeScript"
run_test "TypeScript config valid" "test -f tsconfig.json"
run_test "Types file is valid TypeScript" "npx tsc --noEmit src/lib/types.ts"
echo ""

echo "Test Group 4: Package Metadata"

if test -f app.metadata.json && grep -q "com.bobbysworld.phoenixcreatorstudio" app.metadata.json; then
    echo -e "  ✓ Package ID is correct... ${GREEN}PASS${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "  ✓ Package ID is correct... ${RED}FAIL${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

if test -f app.metadata.json && grep -q '"name".*"Phoenix Creator Studio"' app.metadata.json; then
    echo -e "  ✓ App name is 'Phoenix Creator Studio'... ${GREEN}PASS${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "  ✓ App name is 'Phoenix Creator Studio'... ${RED}FAIL${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

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

echo "Test Group 5: Scripts"
run_test "healthcheck.sh exists" "test -f scripts/healthcheck.sh"
run_test "healthcheck.sh is executable" "test -x scripts/healthcheck.sh"
run_test "smoke-test.sh exists" "test -f scripts/smoke-test.sh"
run_test "smoke-test.sh is executable" "test -x scripts/smoke-test.sh"
echo ""

echo "Test Group 6: API Routes"
run_test "Universe API route exists" "test -f src/app/api/universes/route.ts"
run_test "Generate universe route exists" "test -f src/app/api/generate/universe/route.ts"
run_test "Generate characters route exists" "test -f src/app/api/generate/characters/route.ts"
run_test "Canon block API exists" "test -f src/app/api/lore-engine/canon-block/route.ts"
echo ""

echo "Test Group 7: Component Structure"
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

if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}❌ Smoke tests FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All smoke tests PASSED${NC}"
    echo "Phoenix Creator Studio passed the repository smoke contract."
    exit 0
fi
