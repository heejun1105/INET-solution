# INET 프로젝트 전달 파일

## 📦 이 폴더의 내용

의뢰자께 전달할 **배포에 필요한 핵심 파일**이 포함되어 있습니다.

**⚠️ 주의**: 이 폴더는 **배포 가이드와 핵심 파일만** 포함합니다.
**전체 프로젝트 소스 코드는 별도로 압축하여 전달하세요!**

---

## 📋 포함된 파일

### 1. Docker 관련 (배포 필수)
- `Dockerfile` - 애플리케이션 빌드 및 실행 설정
- `docker-compose.yml.example` - Docker Compose 설정 예시
- `.dockerignore` - Docker 빌드 시 제외할 파일 목록

### 2. 문서 (배포 가이드)
- `docs/DEPLOYMENT_GUIDE.md` - **종합 배포 가이드 (가장 중요!)**
- `docs/HANDOVER_CHECKLIST.md` - 인수인계 체크리스트
- `docs/DELIVERY_LIST.md` - 전달 파일 목록
- `docs/DATABASE_MIGRATION_GUIDE.md` - DB 마이그레이션 가이드
- `docs/JAVA_VERSION_GUIDE.md` - Java 버전 가이드
- 기타 참고 문서들

### 3. 프로젝트 개요
- `README.md` - 프로젝트 개요 및 기능 설명

---

## 🚀 전달 방법

### 방법 1: 전체 프로젝트 + 이 폴더 (권장)

1. **전체 프로젝트 압축**
   - 프로젝트 루트 폴더 전체를 압축
   - 마이그레이션 파일, 소스 코드 모두 포함됨

2. **이 delivery 폴더도 함께 전달**
   - 배포 가이드 문서 포함
   - 핵심 Docker 파일 포함

### 방법 2: 이 폴더만 전달 (비권장)

- 전체 프로젝트 소스 코드가 없으면 빌드 불가
- **반드시 전체 프로젝트도 함께 전달하세요!**

---

## 🚀 빠른 시작

### 1단계: docker-compose.yml 생성
```bash
copy docker-compose.yml.example docker-compose.yml
```

### 2단계: 환경변수 설정
`docker-compose.yml` 파일을 열어서 비밀번호 부분 수정:
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- `SPRING_DATASOURCE_PASSWORD`

### 3단계: 실행
```bash
docker-compose up -d --build
```

---

## 📚 자세한 가이드

**반드시 읽어보세요:**
- `docs/DEPLOYMENT_GUIDE.md` - 종합 배포 가이드

**참고 문서:**
- `docs/HANDOVER_CHECKLIST.md` - 인수인계 체크리스트
- `docs/DATABASE_MIGRATION_GUIDE.md` - DB 마이그레이션 가이드
- `docs/JAVA_VERSION_GUIDE.md` - Java 버전 가이드

---

## ⚠️ 중요 사항

1. **기본 관리자 계정**: `admin` / `admin123!`
   - 운영 환경에서는 반드시 비밀번호 변경하세요!

2. **DB 비밀번호**: 환경변수로 설정하세요
   - `docker-compose.yml`에서 설정

3. **Java 버전**: 걱정 없습니다!
   - Docker 이미지에 Java 21이 이미 포함되어 있습니다

4. **DB 마이그레이션**: 자동으로 실행됩니다
   - `docker-compose up` 실행 시 Flyway가 자동 처리
   - 마이그레이션 파일은 전체 프로젝트 압축에 포함되어 있습니다

---

## 📞 문의사항

배포 중 문제가 발생하면:
1. `docs/DEPLOYMENT_GUIDE.md`의 문제 해결 섹션 참고
2. 로그 확인: `docker-compose logs -f app`
3. 개발자에게 문의

---

**배포 성공을 기원합니다! 🎉**
