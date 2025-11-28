# 운영 환경 설정 가이드 (간단 설명)

## 📌 이 파일이 뭔가요?

운영 서버(Docker/나스)에 배포할 때 필요한 설정 파일입니다.

## 🔑 핵심 개념 (3줄 요약)

1. **개발용 설정**: `application.properties` → 실제 비밀번호가 들어있음 (로컬 개발용)
2. **운영용 예시**: `application-prod.properties.example` → 비밀번호 대신 환경변수 이름만 적음
3. **실제 운영**: Docker에서 환경변수로 비밀번호 전달 → 보안 안전!

## 📝 의뢰자가 해야 할 일

### 1단계: 파일 복사
```
application-prod.properties.example 
→ application-prod.properties 로 복사
```

### 2단계: 환경변수 설정 (Docker 사용 시)

Docker Compose 예시:
```yaml
services:
  inet-app:
    environment:
      - SPRING_DATASOURCE_URL=jdbc:mysql://db:3306/inet?useSSL=false&serverTimezone=Asia/Seoul
      - SPRING_DATASOURCE_USERNAME=inet_user
      - SPRING_DATASOURCE_PASSWORD=실제_비밀번호_입력
```

또는 Docker Run 예시:
```bash
docker run -e SPRING_DATASOURCE_URL="jdbc:mysql://..." \
           -e SPRING_DATASOURCE_USERNAME="inet_user" \
           -e SPRING_DATASOURCE_PASSWORD="실제_비밀번호" \
           ...
```

## ⚠️ 주의사항

- ❌ **절대** `application-prod.properties` 파일에 실제 비밀번호를 직접 적지 마세요!
- ✅ 환경변수로만 전달하세요 (보안)
- ✅ 기본 관리자 계정(`admin`/`admin123!`)은 운영에서 반드시 변경하세요!

## 📋 필요한 환경변수 목록

| 환경변수 이름 | 설명 | 예시 값 |
|-------------|------|---------|
| `SPRING_DATASOURCE_URL` | MySQL 데이터베이스 주소 | `jdbc:mysql://db:3306/inet?useSSL=false&serverTimezone=Asia/Seoul` |
| `SPRING_DATASOURCE_USERNAME` | DB 계정 아이디 | `inet_user` |
| `SPRING_DATASOURCE_PASSWORD` | DB 계정 비밀번호 | `********` (실제 값) |
| `ADMIN_USERNAME` | 초기 관리자 아이디 (선택) | `admin` |
| `ADMIN_PASSWORD` | 초기 관리자 비밀번호 (선택) | `admin123!` (운영에서 변경 필수!) |

## 🎯 요약

- 개발: `application.properties` 사용 (로컬)
- 운영: `application-prod.properties.example` 참고 → 환경변수로 설정
- 보안: 비밀번호는 환경변수로만!

