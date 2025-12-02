# INET 배포 가이드 (의뢰자용)

## 📦 전달받은 파일 목록

의뢰자께서 Docker로 배포하실 때 필요한 파일들입니다:

### 필수 파일
- ✅ `Dockerfile` - 애플리케이션 빌드 및 실행 설정
- ✅ `docker-compose.yml.example` - Docker Compose 설정 예시 (복사해서 사용)
- ✅ `.dockerignore` - Docker 빌드 시 제외할 파일 목록
- ✅ `src/main/resources/application-prod.properties.example` - 운영 환경 설정 예시 (전체 프로젝트에 포함)

### 참고 문서
- ✅ `docs/DEPLOYMENT_GUIDE.md` - 이 문서 (종합 가이드)
- ✅ `docs/DEPLOYMENT_ENV_SETUP.md` - 환경변수 설정 상세 가이드
- ✅ `docs/DATABASE_MIGRATION_GUIDE.md` - 데이터베이스 마이그레이션 가이드
- ✅ `docs/JAVA_VERSION_GUIDE.md` - Java 버전 가이드

---

## 🚀 빠른 시작 (3단계)

### 1단계: docker-compose.yml 파일 생성

```bash
# 예시 파일을 복사
cp docker-compose.yml.example docker-compose.yml
```

### 2단계: 환경변수 설정

`docker-compose.yml` 파일을 열어서 다음 부분을 수정하세요:

```yaml
services:
  db:
    environment:
      MYSQL_ROOT_PASSWORD: 실제_루트_비밀번호_입력  # ⚠️ 변경 필요
      MYSQL_PASSWORD: 실제_DB_비밀번호_입력          # ⚠️ 변경 필요

  app:
    environment:
      SPRING_DATASOURCE_PASSWORD: 실제_DB_비밀번호_입력  # ⚠️ 변경 필요 (위와 동일하게)
```

### 3단계: 실행

```bash
# Docker 이미지 빌드 및 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f app
```

---

## 📋 상세 배포 절차

### 1. 사전 준비사항

- ✅ Docker 및 Docker Compose 설치 완료
- ✅ MySQL 8.0 이상 (또는 Docker로 자동 설치)
- ✅ 포트 8082, 3306 사용 가능 여부 확인

### 2. 파일 준비

#### 2-1. docker-compose.yml 생성

```bash
cp docker-compose.yml.example docker-compose.yml
```

#### 2-2. docker-compose.yml 수정

**반드시 변경해야 할 부분:**

```yaml
services:
  db:
    environment:
      # ⚠️ 이 부분을 실제 비밀번호로 변경하세요!
      MYSQL_ROOT_PASSWORD: your_secure_root_password
      MYSQL_PASSWORD: your_secure_db_password

  app:
    environment:
      # ⚠️ 위의 MYSQL_PASSWORD와 동일하게 설정하세요!
      SPRING_DATASOURCE_PASSWORD: your_secure_db_password
```

**선택사항 (기본값 사용 가능):**

```yaml
services:
  app:
    environment:
      # 관리자 계정 (운영에서는 반드시 변경 권장!)
      ADMIN_USERNAME: admin
      ADMIN_PASSWORD: admin123!  # ⚠️ 운영에서는 변경 필수!
```

### 3. 데이터베이스 마이그레이션

프로젝트에는 Flyway를 통한 자동 마이그레이션이 설정되어 있습니다.
첫 실행 시 자동으로 데이터베이스 스키마가 생성됩니다.

**마이그레이션 파일 위치:**
```
src/main/resources/db/migration/  (전체 프로젝트에 포함됨)
```

### 4. Docker 빌드 및 실행

#### 방법 1: Docker Compose 사용 (권장)

```bash
# 빌드 및 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f app

# 상태 확인
docker-compose ps
```

#### 방법 2: Docker 직접 사용

```bash
# 이미지 빌드
docker build -t inet-app .

# 컨테이너 실행
docker run -d \
  --name inet-app \
  -p 8082:8082 \
  -e SPRING_DATASOURCE_URL="jdbc:mysql://db_host:3306/inet?useSSL=false&serverTimezone=Asia/Seoul" \
  -e SPRING_DATASOURCE_USERNAME="inet_user" \
  -e SPRING_DATASOURCE_PASSWORD="실제_비밀번호" \
  inet-app
```

### 5. 접속 확인

브라우저에서 다음 주소로 접속:

```
http://서버주소:8082
```

**기본 관리자 계정:**
- 아이디: `admin`
- 비밀번호: `admin123!`

⚠️ **보안**: 운영 환경에서는 반드시 관리자 비밀번호를 변경하세요!

---

## 🔧 환경변수 설정 가이드

### 필수 환경변수

| 환경변수 이름 | 설명 | 예시 값 |
|-------------|------|---------|
| `SPRING_DATASOURCE_URL` | MySQL 데이터베이스 주소 | `jdbc:mysql://db:3306/inet?useSSL=false&serverTimezone=Asia/Seoul` |
| `SPRING_DATASOURCE_USERNAME` | DB 계정 아이디 | `inet_user` |
| `SPRING_DATASOURCE_PASSWORD` | DB 계정 비밀번호 | `********` (실제 값) |

### 선택 환경변수

| 환경변수 이름 | 설명 | 기본값 |
|-------------|------|--------|
| `ADMIN_USERNAME` | 초기 관리자 아이디 | `admin` |
| `ADMIN_PASSWORD` | 초기 관리자 비밀번호 | `admin123!` |
| `SERVER_PORT` | 서버 포트 | `8082` |
| `SPRING_PROFILES_ACTIVE` | Spring 프로파일 | `prod` |

### 환경변수 설정 방법

#### Docker Compose 사용 시

`docker-compose.yml` 파일의 `environment` 섹션에 추가:

```yaml
services:
  app:
    environment:
      - SPRING_DATASOURCE_URL=jdbc:mysql://db:3306/inet?useSSL=false&serverTimezone=Asia/Seoul
      - SPRING_DATASOURCE_USERNAME=inet_user
      - SPRING_DATASOURCE_PASSWORD=실제_비밀번호
```

#### Docker Run 사용 시

```bash
docker run -e SPRING_DATASOURCE_PASSWORD="실제_비밀번호" ...
```

#### 환경변수 파일 사용 (.env)

```bash
# .env 파일 생성
cat > .env << EOF
SPRING_DATASOURCE_PASSWORD=실제_비밀번호
MYSQL_ROOT_PASSWORD=실제_루트_비밀번호
EOF

# docker-compose.yml에서 사용
docker-compose up -d
```

---

## 🛠️ 유지보수 및 관리

### 로그 확인

```bash
# 애플리케이션 로그
docker-compose logs -f app

# 데이터베이스 로그
docker-compose logs -f db

# 모든 로그
docker-compose logs -f
```

### 컨테이너 재시작

```bash
# 애플리케이션만 재시작
docker-compose restart app

# 전체 재시작
docker-compose restart
```

### 데이터베이스 백업

```bash
# 백업
docker-compose exec db mysqldump -u root -p inet > backup_$(date +%Y%m%d).sql

# 복원
docker-compose exec -T db mysql -u root -p inet < backup_20250101.sql
```

### 업데이트 (새 버전 배포)

```bash
# 1. 최신 코드 받기
git pull

# 2. 이미지 재빌드
docker-compose build --no-cache

# 3. 컨테이너 재시작
docker-compose up -d
```

---

## ⚠️ 주의사항 및 문제 해결

### 보안 주의사항

1. ❌ **절대** `application-prod.properties` 파일에 실제 비밀번호를 직접 적지 마세요!
2. ✅ 환경변수로만 전달하세요
3. ✅ 기본 관리자 계정(`admin`/`admin123!`)은 운영에서 반드시 변경하세요!
4. ✅ `.env` 파일은 `.gitignore`에 추가하여 Git에 커밋하지 마세요!

### 자주 발생하는 문제

#### 1. 데이터베이스 연결 실패

**증상**: 애플리케이션이 시작되지 않음

**해결책**:
- `docker-compose.yml`의 `SPRING_DATASOURCE_PASSWORD`가 DB의 `MYSQL_PASSWORD`와 일치하는지 확인
- DB 컨테이너가 정상 실행 중인지 확인: `docker-compose ps`
- DB 로그 확인: `docker-compose logs db`

#### 2. 포트 충돌

**증상**: `port is already allocated` 오류

**해결책**:
- `docker-compose.yml`에서 포트 번호 변경 (예: `8083:8082`)
- 또는 기존 컨테이너 중지: `docker-compose down`

#### 3. 권한 오류

**증상**: 파일 생성/수정 권한 오류

**해결책**:
- 로그 디렉토리 권한 확인: `chmod 755 logs/`
- Docker 볼륨 마운트 경로 확인

### 헬스체크

애플리케이션이 정상 실행 중인지 확인:

```bash
# 헬스체크 (Dockerfile에 설정됨)
docker inspect inet-app | grep -A 10 Health

# 수동 확인
curl http://localhost:8082/actuator/health
```

---

## 📞 문의사항

배포 중 문제가 발생하면 다음 정보를 함께 전달해주세요:

1. Docker 및 Docker Compose 버전
2. 오류 메시지 전체 내용
3. `docker-compose logs app` 출력 결과
4. `docker-compose ps` 출력 결과

---

## 📚 추가 참고 자료

- `docs/DEPLOYMENT_ENV_SETUP.md` - 환경변수 설정 상세 가이드
- `docs/DATABASE_MIGRATION_GUIDE.md` - **데이터베이스 마이그레이션 가이드** (중요!)
- `docs/JAVA_VERSION_GUIDE.md` - **Java 버전 가이드** (중요!)
- `src/main/resources/application-prod.properties.example` - 운영 설정 예시 (전체 프로젝트에 포함)
- `README.md` - 프로젝트 개요 및 기능 설명

---

## 💾 데이터베이스 마이그레이션

### 자동 실행 (Docker 사용 시)

**Docker로 실행하면 자동으로 처리됩니다!**

- 애플리케이션 시작 시 Flyway가 자동으로 모든 마이그레이션을 실행합니다
- 첫 실행 시: 모든 마이그레이션 파일이 순서대로 실행됩니다
- 이후 실행 시: 새로운 마이그레이션 파일만 실행됩니다

**별도 작업 불필요!** ✅

### 마이그레이션 파일 위치
```
src/main/resources/db/migration/  (전체 프로젝트에 포함됨)
```

### 수동 확인 (필요 시)

마이그레이션 상태를 확인하려면:

```sql
-- Flyway 히스토리 테이블 조회
SELECT * FROM flyway_schema_history ORDER BY installed_rank DESC;
```

**자세한 내용은 `docs/DATABASE_MIGRATION_GUIDE.md`를 참고하세요.**

---

## ☕ Java 버전

### Docker 사용 시 (권장)

**Java 버전 걱정 없습니다!** ✅

- Docker 이미지에 **Java 21**이 이미 포함되어 있습니다
- `docker-compose up`만 실행하면 됩니다
- 별도 Java 설치 불필요

### 로컬 설치 시

만약 Docker를 사용하지 않는다면:

- **Java 21**이 필요합니다
- 설치 방법: https://adoptium.net/temurin/releases/
- Java 21 LTS 버전을 다운로드하여 설치하세요

**자세한 내용은 `docs/JAVA_VERSION_GUIDE.md`를 참고하세요.**

---

## ✅ 배포 체크리스트

배포 전 확인사항:

- [ ] `docker-compose.yml` 파일 생성 및 환경변수 설정 완료
- [ ] DB 비밀번호 변경 완료
- [ ] 관리자 계정 비밀번호 변경 완료 (운영 환경)
- [ ] 포트 8082, 3306 사용 가능 확인
- [ ] Docker 및 Docker Compose 설치 확인
- [ ] 데이터베이스 백업 계획 수립
- [ ] 로그 모니터링 방법 확인

---

**배포 성공을 기원합니다! 🎉**

