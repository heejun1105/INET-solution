# 의뢰자 전달 파일 목록

## 📦 필수 전달 파일

### 1. Docker 관련 파일
- ✅ `Dockerfile` - 애플리케이션 빌드 및 실행 설정
- ✅ `docker-compose.yml.example` - Docker Compose 설정 예시 (복사해서 사용)
- ✅ `.dockerignore` - Docker 빌드 시 제외할 파일 목록

### 2. 설정 파일
- ✅ `src/main/resources/application-prod.properties.example` - 운영 환경 설정 예시

### 3. 소스 코드
- ✅ 전체 프로젝트 소스 코드 (Git 저장소 또는 압축 파일)
- ✅ `src/main/resources/db/migration/` - 데이터베이스 마이그레이션 파일

---

## 📚 문서 (참고용)

### 필수 문서
- ✅ `docs/DEPLOYMENT_GUIDE.md` - **종합 배포 가이드 (가장 중요!)**
- ✅ `docs/HANDOVER_CHECKLIST.md` - 인수인계 체크리스트

### 참고 문서
- ✅ `docs/DEPLOYMENT_ENV_SETUP.md` - 환경변수 설정 상세 가이드
- ✅ `README.md` - 프로젝트 개요 및 기능 설명

---

## 🚀 빠른 시작 (의뢰자용)

### 1단계: 파일 복사
```bash
cp docker-compose.yml.example docker-compose.yml
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

**자세한 내용은 `docs/DEPLOYMENT_GUIDE.md`를 참고하세요!**

---

## 📋 파일 위치 요약

```
INET/
├── Dockerfile                          ← 필수
├── docker-compose.yml.example           ← 필수 (복사해서 사용)
├── .dockerignore                        ← 필수
├── src/
│   └── main/
│       └── resources/
│           ├── application-prod.properties.example  ← 필수
│           └── db/
│               └── migration/          ← 필수 (DB 마이그레이션)
└── docs/
    ├── DEPLOYMENT_GUIDE.md             ← 필수 (가장 중요!)
    ├── HANDOVER_CHECKLIST.md            ← 필수
    ├── DEPLOYMENT_ENV_SETUP.md         ← 참고
    └── DELIVERY_LIST.md                 ← 이 파일
```

---

## ✅ 전달 전 최종 확인

의뢰자에게 전달하기 전에 확인:

- [ ] 모든 필수 파일이 포함되어 있는가?
- [ ] `docs/DEPLOYMENT_GUIDE.md`가 포함되어 있는가?
- [ ] 소스 코드에 실제 비밀번호가 하드코딩되어 있지 않은가?
- [ ] `.env` 파일이나 민감한 정보가 Git에 커밋되지 않았는가?

---

**전달 준비 완료! 🎉**

