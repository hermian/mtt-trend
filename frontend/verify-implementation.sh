#!/bin/bash
# SPEC-MTT-005 구현 검증 스크립트

echo "=== SPEC-MTT-005 구현 검증 ==="
echo ""

echo "1. F-01: 상위 5개 테마 자동 선택 구현 확인"
echo "   - useEffect 훅으로 자동 선택 로직 확인"
grep -A 5 "useEffect" src/app/trend/_components/ThemeTrendChart.tsx | grep -q "top5Themes" && echo "   ✓ 상위 5개 테마 자동 선택 로직 확인" || echo "   ✗ 상위 5개 테마 자동 선택 로직 미발견"

echo ""
echo "2. F-03: 더블클릭 토글 구현 확인"
echo "   - disabledThemes 상태 확인"
grep -q "disabledThemes" src/app/trend/_components/ThemeTrendChart.tsx && echo "   ✓ disabledThemes 상태 확인" || echo "   ✗ disabledThemes 상태 미발견"
echo "   - toggleThemeDisabled 함수 확인"
grep -q "toggleThemeDisabled" src/app/trend/_components/ThemeTrendChart.tsx && echo "   ✓ toggleThemeDisabled 함수 확인" || echo "   ✗ toggleThemeDisabled 함수 미발견"
echo "   - onDoubleClick 핸들러 확인"
grep -q "onDoubleClick" src/app/trend/_components/ThemeTrendChart.tsx && echo "   ✓ onDoubleClick 핸들러 확인" || echo "   ✗ onDoubleClick 핸들러 미발견"
echo "   - strokeOpacity 설정 확인"
grep -q "strokeOpacity" src/app/trend/_components/ThemeTrendChart.tsx && echo "   ✓ strokeOpacity 설정 확인" || echo "   ✗ strokeOpacity 설정 미발견"

echo ""
echo "3. F-04: 단일 데이터 포인트 dot 표시 구현 확인"
echo "   - isSinglePointTheme 함수 확인"
grep -q "isSinglePointTheme" src/app/trend/_components/ThemeTrendChart.tsx && echo "   ✓ isSinglePointTheme 함수 확인" || echo "   ✗ isSinglePointTheme 함수 미발견"
echo "   - 조건부 dot 렌더링 확인"
grep -A 2 "dot={isSinglePoint" src/app/trend/_components/ThemeTrendChart.tsx | grep -q "r: 8" && echo "   ✓ 단일 포인트 dot 렌더링 확인" || echo "   ✗ 단일 포인트 dot 렌더링 미발견"

echo ""
echo "4. F-01: 사용자 수동 변경 후 자동 선택 방지 구현 확인"
echo "   - isUserModified 상태 확인"
grep -q "isUserModified" src/app/trend/_components/ThemeTrendChart.tsx && echo "   ✓ isUserModified 상태 확인" || echo "   ✗ isUserModified 상태 미발견"
echo "   - toggleTheme에서 setIsUserModified 호출 확인"
grep -A 3 "const toggleTheme" src/app/trend/_components/ThemeTrendChart.tsx | grep -q "setIsUserModified" && echo "   ✓ toggleTheme에서 사용자 수정 플래그 설정 확인" || echo "   ✗ toggleTheme에서 사용자 수정 플래그 설정 미발견"

echo ""
echo "5. 빈 데이터 상태 메시지 확인"
grep -q "데이터가 없습니다" src/app/trend/_components/ThemeTrendChart.tsx && echo "   ✓ 빈 데이터 메시지 확인" || echo "   ✗ 빈 데이터 메시지 미발견"

echo ""
echo "6. @MX 태그 확인"
grep -q "@MX:NOTE" src/app/trend/_components/ThemeTrendChart.tsx && echo "   ✓ @MX:NOTE 태그 확인" || echo "   ✗ @MX:NOTE 태그 미발견"

echo ""
echo "=== 검증 완료 ==="
