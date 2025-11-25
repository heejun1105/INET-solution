# 배포 가이드

## 사전 준비사항

### 1. 환경 변수 설정
다음 환경 변수들을 설정해야 합니다:

```bash
# 데이터베이스 설정
DB_HOST=localhost          # MySQL 호스트
DB_PORT=3306               # MySQL 포트
DB_NAME=inet               # 데이터베이스 이름
DB_USERNAME=root            # 데이터베이스 사용자명
DB_PASSWORD=your_password   # 데이터베이스 비밀번호

# 서버 설정
SERVER_PORT=8082            # 애플리케이션 포트

# 관리자 계정 설정
ADMIN_USERNAME=admin        # 관리자 사용자명
ADMIN_PASSWORD=your_password # 관리자 비밀번호
```

### 2. 데이터베이스 준비
- MySQL 8.0 이상 필요
- 데이터베이스 생성: `CREATE DATABASE inet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
- Flyway 마이그레이션 스크립트가 자동으로 실행됩니다

## Docker를 사용한 배포

### 1. Dockerfile 빌드
```bash
docker build -t inet-app:latest .
```

### 2. Docker Compose 사용 (선택사항)
```bash
# docker-compose.yml.example을 참고하여 docker-compose.yml 생성
cp docker-compose.yml.example docker-compose.yml

# 환경 변수 설정
export DB_PASSWORD=your_password
export ADMIN_PASSWORD=your_password

# 실행
docker-compose up -d
```

### 3. 단일 컨테이너 실행
```bash
docker run -d \
  --name inet-app \
  -p 8082:8082 \
  -e DB_HOST=your_db_host \
  -e DB_PORT=3306 \
  -e DB_NAME=inet \
  -e DB_USERNAME=root \
  -e DB_PASSWORD=your_password \
  -e SERVER_PORT=8082 \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=your_password \
  -v $(pwd)/logs:/app/logs \
  inet-app:latest
```

## NAS 서버 배포 시 주의사항

### 1. 데이터베이스 연결
- NAS 서버의 MySQL이 별도로 실행 중인 경우, `DB_HOST`를 해당 IP로 설정
- Docker 네트워크를 사용하는 경우, 서비스 이름 사용 (예: `mysql`)

### 2. 포트 설정
- NAS 서버의 방화벽에서 8082 포트가 열려있는지 확인
- 필요시 리버스 프록시(Nginx 등) 설정

### 3. 로그 관리
- 로그 파일은 `/app/logs` 디렉토리에 저장됩니다
- 볼륨 마운트를 통해 로그를 외부에서 접근 가능하게 설정

### 4. 데이터 영속성
- 데이터베이스 데이터는 볼륨에 저장되어야 합니다
- Docker Compose를 사용하는 경우 자동으로 볼륨이 생성됩니다

## 배포 후 확인사항

1. **애플리케이션 실행 확인**
   ```bash
   docker logs inet-app
   ```

2. **헬스체크**
   - 브라우저에서 `http://your-server:8082` 접속
   - 로그인 페이지가 표시되는지 확인

3. **데이터베이스 연결 확인**
   - 애플리케이션 로그에서 데이터베이스 연결 성공 메시지 확인

4. **기능 테스트**
   - 관리자 계정으로 로그인
   - 주요 기능들이 정상 작동하는지 확인

## 문제 해결

### 데이터베이스 연결 실패
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` 확인
- MySQL이 실행 중인지 확인
- 방화벽 설정 확인

### 포트 충돌
- `SERVER_PORT` 환경 변수로 다른 포트 사용
- 또는 Docker 포트 매핑 변경: `-p 8083:8082`

### 로그 확인
```bash
# 컨테이너 로그 확인
docker logs inet-app

# 실시간 로그 확인
docker logs -f inet-app

# 로그 파일 확인 (볼륨 마운트된 경우)
tail -f logs/spring.log
```

