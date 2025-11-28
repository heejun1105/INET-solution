# 의뢰자 인수인계 체크리스트

## 📋 전달 항목 확인

### ✅ 필수 파일 (반드시 전달)

- [x] `Dockerfile` - 애플리케이션 빌드 설정
- [x] `docker-compose.yml.example` - Docker Compose 설정 예시
- [x] `.dockerignore` - 빌드 제외 파일 목록
- [x] `src/main/resources/application-prod.properties.example` - 운영 설정 예시

### ✅ 문서 (참고용)

- [x] `docs/DEPLOYMENT_GUIDE.md` - 종합 배포 가이드
- [x] `docs/DEPLOYMENT_ENV_SETUP.md` - 환경변수 설정 가이드
- [x] `docs/HANDOVER_CHECKLIST.md` - 이 체크리스트
- [x] `README.md` - 프로젝트 개요

### ✅ 소스 코드

- [x] 전체 소스 코드 (Git 저장소 또는 압축 파일)
- [x] 데이터베이스 마이그레이션 파일 (`src/main/resources/db/migration/`)

---

## 🔑 의뢰자가 해야 할 일

### 1단계: 파일 준비

```bash
# 1. docker-compose.yml 생성
cp docker-compose.yml.example docker-compose.yml

# 2. 환경변수 설정 (docker-compose.yml 수정)
# - MYSQL_ROOT_PASSWORD
# - MYSQL_PASSWORD  
# - SPRING_DATASOURCE_PASSWORD
```

### 2단계: 배포 실행

```bash
# Docker Compose로 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f app
```

### 3단계: 접속 확인

- 브라우저에서 `http://서버주소:8082` 접속
- 기본 관리자 계정으로 로그인: `admin` / `admin123!`
- **⚠️ 운영 환경에서는 반드시 관리자 비밀번호 변경!**

---

## ⚠️ 보안 체크리스트

의뢰자께서 반드시 확인하실 사항:

- [ ] DB 비밀번호를 기본값에서 변경했는가?
- [ ] 관리자 계정 비밀번호를 변경했는가? (운영 환경)
- [ ] 환경변수 파일(.env)이 Git에 커밋되지 않았는가?
- [ ] `application-prod.properties`에 실제 비밀번호가 직접 적혀있지 않은가?

---

## 📞 지원 범위

### 개발자가 지원 가능한 것

- ✅ 배포 가이드 및 문서 제공
- ✅ 코드 레벨 문제 해결
- ✅ 기능 개선 요청

### 의뢰자가 직접 해야 할 것

- ⚠️ Docker/Docker Compose 설치 및 설정
- ⚠️ 서버 인프라 구성 (네트워크, 방화벽 등)
- ⚠️ 데이터베이스 운영 및 백업
- ⚠️ 도메인 및 SSL 인증서 설정
- ⚠️ 모니터링 및 로그 관리

---

## 🎯 배포 후 확인사항

의뢰자께서 배포 후 확인하실 항목:

- [ ] 애플리케이션이 정상 실행 중인가? (`docker-compose ps`)
- [ ] 웹 페이지에 접속이 가능한가? (`http://서버주소:8082`)
- [ ] 로그인 및 기본 기능이 동작하는가?
- [ ] 데이터베이스 연결이 정상인가? (로그 확인)
- [ ] 로그 파일이 정상 생성되는가? (`logs/spring.log`)

---

## 📝 전달 메시지 예시

의뢰자께 전달하실 때 참고하세요:

```
안녕하세요.

INET 프로젝트 배포 준비가 완료되었습니다.

전달 파일:
1. Dockerfile
2. docker-compose.yml.example
3. application-prod.properties.example
4. 배포 가이드 문서 (docs/DEPLOYMENT_GUIDE.md)

배포 방법:
1. docker-compose.yml.example을 docker-compose.yml로 복사
2. docker-compose.yml에서 DB 비밀번호 설정
3. docker-compose up -d --build 실행

자세한 내용은 docs/DEPLOYMENT_GUIDE.md를 참고해주세요.

문의사항이 있으시면 언제든지 연락주세요.
```

---

**인수인계 완료! 🎉**

