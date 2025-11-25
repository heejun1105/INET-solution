# 배포 전 체크리스트

## 1. 디버깅 코드 제거 ✅
- [x] System.out.println 제거 (177개 발견)
- [x] 디버깅용 API 엔드포인트 제거 (/api/debug/*)
- [ ] PPTExportService의 디버깅 출력 제거

## 2. 설정 파일 정리
- [ ] application.properties 프로덕션 설정으로 변경
  - 로깅 레벨: DEBUG → INFO
  - show-sql: true → false
  - Thymeleaf 캐시: false → true
  - DevTools 비활성화
  - 정적 리소스 캐시 활성화

## 3. 환경 변수 설정
- [ ] 데이터베이스 연결 정보 (환경 변수로 설정)
- [ ] 관리자 계정 정보 (환경 변수로 설정)
- [ ] 서버 포트 설정

## 4. Docker 관련 파일
- [ ] Dockerfile 생성
- [ ] docker-compose.yml 생성 (선택사항)
- [ ] .dockerignore 생성

## 5. 문서화
- [ ] 배포 가이드 작성
- [ ] 환경 변수 목록 문서화
- [ ] 데이터베이스 마이그레이션 가이드

## 6. 보안 검토
- [ ] 하드코딩된 비밀번호 제거
- [ ] 민감한 정보 환경 변수화
- [ ] 불필요한 디버깅 엔드포인트 제거

## 7. 성능 최적화
- [ ] 로깅 레벨 최적화
- [ ] 캐시 설정 활성화
- [ ] 불필요한 의존성 제거

