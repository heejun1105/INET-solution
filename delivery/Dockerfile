# Multi-stage build를 사용하여 최적화된 이미지 생성
FROM gradle:8.5-jdk21 AS build
WORKDIR /app

# Gradle 캐시를 활용하기 위해 build.gradle과 settings.gradle을 먼저 복사
COPY build.gradle settings.gradle ./
COPY gradle ./gradle

# 의존성 다운로드 (캐시 활용)
RUN gradle dependencies --no-daemon || true

# 소스 코드 복사 및 빌드
COPY . .
RUN gradle clean bootJar --no-daemon

# 실행 단계
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# 타임존 설정
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime && \
    echo "Asia/Seoul" > /etc/timezone && \
    apk del tzdata

# 애플리케이션 JAR 복사
COPY --from=build /app/build/libs/*.jar app.jar

# 로그 디렉토리 생성
RUN mkdir -p /app/logs

# 포트 노출
EXPOSE 8082

# 환경 변수 설정 (기본값 - 실제 운영에서는 docker-compose나 docker run으로 덮어씀)
ENV SPRING_PROFILES_ACTIVE=prod
ENV SERVER_PORT=8082
# 데이터베이스 연결은 환경변수로 전달 (보안)
# SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${SERVER_PORT}/actuator/health || exit 1

# 애플리케이션 실행
ENTRYPOINT ["java", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-Dfile.encoding=UTF-8", \
  "-Xmx512m", \
  "-Xms256m", \
  "-jar", \
  "app.jar"]

