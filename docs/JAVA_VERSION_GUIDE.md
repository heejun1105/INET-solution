# Java 버전 가이드

## 📌 현재 프로젝트 Java 버전

이 프로젝트는 **Java 21**을 사용합니다.

```gradle
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}
```

---

## 🐳 Docker 사용 시 (권장 - 자동 해결!)

**Docker를 사용하면 Java 버전 문제가 자동으로 해결됩니다!**

### Dockerfile 확인

현재 `Dockerfile`은 이미 Java 21을 포함하고 있습니다:

```dockerfile
# 빌드 단계: Java 21 포함
FROM gradle:8.5-jdk21 AS build

# 실행 단계: Java 21 JRE 포함
FROM eclipse-temurin:21-jre-alpine
```

**의뢰자가 해야 할 일:**
- ✅ **아무것도 안 해도 됩니다!**
- Docker 이미지에 Java 21이 이미 포함되어 있습니다
- `docker-compose up`만 실행하면 됩니다

---

## 💻 로컬 설치 시 (Docker 미사용)

만약 Docker를 사용하지 않고 로컬에서 직접 실행한다면:

### 1. Java 21 설치 확인

```bash
# Java 버전 확인
java -version

# 출력 예시:
# openjdk version "21.0.1" 2023-10-17
# OpenJDK Runtime Environment (build 21.0.1+12-24)
# OpenJDK 64-Bit Server VM (build 21.0.1+12-24, mixed mode, sharing)
```

### 2. Java 21이 없는 경우

#### Windows
1. **Eclipse Temurin 다운로드**
   - https://adoptium.net/temurin/releases/
   - Java 21 LTS 선택
   - Windows x64 설치 파일 다운로드

2. **설치 후 환경변수 설정**
   - `JAVA_HOME` 환경변수 설정
   - `PATH`에 `%JAVA_HOME%\bin` 추가

#### Linux (Ubuntu/Debian)
```bash
# OpenJDK 21 설치
sudo apt update
sudo apt install openjdk-21-jdk

# 버전 확인
java -version
```

#### Linux (CentOS/RHEL)
```bash
# OpenJDK 21 설치
sudo yum install java-21-openjdk-devel

# 버전 확인
java -version
```

#### macOS
```bash
# Homebrew 사용
brew install openjdk@21

# 환경변수 설정
echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 버전 확인
java -version
```

### 3. Gradle로 빌드 및 실행

Java 21 설치 후:

```bash
# 빌드
./gradlew build

# 실행
./gradlew bootRun
```

**Gradle이 자동으로 Java 21을 사용합니다!**

---

## 🔧 Java 버전 호환성 문제 해결

### 문제 1: "Unsupported class file major version"

**원인**: Java 버전이 낮음

**해결**:
- Java 21 설치 (위의 설치 방법 참고)
- 또는 Docker 사용 (권장)

### 문제 2: "Java toolchain not found"

**원인**: Gradle이 Java 21을 찾지 못함

**해결**:
```bash
# Gradle에 Java 21 경로 명시
./gradlew build -Dorg.gradle.java.home=/path/to/java21
```

또는 `gradle.properties` 파일 생성:
```properties
org.gradle.java.home=/path/to/java21
```

### 문제 3: Docker에서 Java 버전 확인

```bash
# 컨테이너 내부 Java 버전 확인
docker-compose exec app java -version
```

---

## 📋 요약 및 권장사항

### ✅ 권장 방법: Docker 사용

**장점:**
- ✅ Java 버전 자동 해결 (이미 Dockerfile에 포함)
- ✅ 환경 차이 없음 (Windows/Mac/Linux 동일)
- ✅ 의존성 문제 없음
- ✅ 배포 간편

**의뢰자가 해야 할 일:**
- Docker 및 Docker Compose 설치만 하면 됩니다
- Java 21 별도 설치 불필요

### ⚠️ 수동 설치 시

**필요한 것:**
- Java 21 JDK 설치
- 환경변수 설정 (`JAVA_HOME`, `PATH`)
- 버전 확인 (`java -version`)

---

## 🎯 의뢰자에게 전달할 메시지

### Docker 사용 시
```
Java 버전은 걱정하지 마세요!
Docker 이미지에 Java 21이 이미 포함되어 있습니다.
docker-compose up만 실행하면 됩니다.
```

### 로컬 설치 시
```
Java 21이 필요합니다.
설치 방법: https://adoptium.net/temurin/releases/
Java 21 LTS 버전을 다운로드하여 설치하세요.
```

---

**가장 간단한 방법은 Docker를 사용하는 것입니다! 🐳**

