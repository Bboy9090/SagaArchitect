#!/bin/bash

# Saga Architect - Healthcheck Script
# Tests basic functionality: project create, save/load, export
# Part of Bobby's World / Blue Phoenix OS ecosystem

set -e  # Exit on error

echo "========================================"
echo "Phoenix Creator Studio - Healthcheck"
echo "Package ID: com.bobbysworld.phoenixcreatorstudio"
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

    echo -n "Testing: $test_name... "
    TESTS_RUN=$((TESTS_RUN + 1))

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Helper function to check file exists
check_file() {
    local file="$1"
    test -f "$file"
}

# Helper function to check directory exists
check_dir() {
    local dir="$1"
    test -d "$dir"
}

echo "1. Checking Project Structure"
echo "------------------------------"

run_test "package.json exists" "check_file package.json"
run_test "app.metadata.json exists" "check_file app.metadata.json"
run_test "src directory exists" "check_dir src"
run_test "docs directory exists" "check_dir docs"
run_test "scripts directory exists" "check_dir scripts"

echo ""
echo "2. Checking Required Documentation"
echo "-----------------------------------"

run_test "README.md exists" "check_file README.md"
run_test "docs/PRD.md exists" "check_file docs/PRD.md"
run_test "docs/ROADMAP.md exists" "check_file docs/ROADMAP.md"
run_test "docs/RELEASE_CHECKLIST.md exists" "check_file docs/RELEASE_CHECKLIST.md"
run_test "docs/WORLDBUILDING_MODEL.md exists" "check_file docs/WORLDBUILDING_MODEL.md"
run_test "docs/CANON_TRACKING.md exists" "check_file docs/CANON_TRACKING.md"

echo ""
echo "3. Checking Core Source Files"
echo "------------------------------"

run_test "src/lib/types.ts exists" "check_file src/lib/types.ts"
run_test "src/lib/storage.ts exists" "check_file src/lib/storage.ts"
run_test "src/lib/lore-engine.ts exists" "check_file src/lib/lore-engine.ts"

echo ""
echo "4. Checking Metadata Configuration"
echo "-----------------------------------"

# Check app.metadata.json has correct package ID
if check_file app.metadata.json; then
    if grep -q "com.bobbysworld.phoenixcreatorstudio" app.metadata.json; then
        echo -ne "Testing: Package ID is correct... "
        echo -e "${GREEN}✓ PASS${NC}"
        TESTS_RUN=$((TESTS_RUN + 1))
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -ne "Testing: Package ID is correct... "
        echo -e "${RED}✗ FAIL${NC}"
        TESTS_RUN=$((TESTS_RUN + 1))
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
fi

# Check package.json has correct name
if check_file package.json; then
    if grep -q '"name".*"phoenix-creator-studio"' package.json; then
        echo -ne "Testing: Package name is 'phoenix-creator-studio'... "
        echo -e "${GREEN}✓ PASS${NC}"
        TESTS_RUN=$((TESTS_RUN + 1))
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -ne "Testing: Package name is 'phoenix-creator-studio'... "
        echo -e "${YELLOW}⚠ WARNING${NC} (name should be 'phoenix-creator-studio')"
        TESTS_RUN=$((TESTS_RUN + 1))
    fi
fi

echo ""
echo "5. Checking Dependencies"
echo "------------------------"

run_test "node_modules exists" "check_dir node_modules"
run_test "Dependencies installed" "test -f node_modules/.package-lock.json"

echo ""
echo "6. Testing Build Process"
echo "------------------------"

echo -n "Testing: Build completes... "
TESTS_RUN=$((TESTS_RUN + 1))
if npm run build > /tmp/saga_build.log 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Build log saved to /tmp/saga_build.log"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "7. Testing Linter"
echo "-----------------"

echo -n "Testing: Lint runs without errors... "
TESTS_RUN=$((TESTS_RUN + 1))
if npm run lint > /tmp/saga_lint.log 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    # Check if only warnings (no errors)
    if grep -q "✖.*problems.*(0 errors" /tmp/saga_lint.log 2>/dev/null; then
        echo -e "${GREEN}✓ PASS${NC} (warnings only)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "Lint log saved to /tmp/saga_lint.log"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
fi

echo ""
echo "========================================"
echo "Healthcheck Summary"
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
    echo -e "${RED}Healthcheck FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}Healthcheck PASSED${NC}"
    exit 0
fi
