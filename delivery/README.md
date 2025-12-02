# INET

학교 네트워크 장비 관리 시스템

## 주요 기능

### 1. 장비 관리
- 장비 등록/수정/삭제
- 장비 목록 조회 및 필터링
- 엑셀 다운로드 기능

### 2. 학교 관리
- 학교 정보 관리
- 학교별 장비 현황 조회
- 학교 구조도 시각화

### 3. 교실 관리
- 교실 정보 관리
- 교실별 장비 배치 현황
- 교실 레이아웃 관리

### 4. QR 코드 생성 (신규 기능)
- 학교별 고유번호를 QR 코드로 변환
- displayUid 값을 인코딩한 QR 코드 생성
- A4 용지에 최적화된 엑셀 파일 다운로드
- 가로 4개, 세로 4cm 크기의 QR 코드 레이아웃

### 5. 보안 기능
- Spring Security 기반 인증/인가
- 사용자 권한 관리
- 학교별 접근 권한 제어

## 기술 스택

- **Backend**: Java 21, Spring Boot 3.2.3, Spring Data JPA, Spring Security
- **Database**: MySQL 8
- **Frontend**: Thymeleaf, HTML/CSS, JavaScript
- **Build Tool**: Gradle
- **QR Code**: Google ZXing 라이브러리
- **Excel**: Apache POI

## 설치 및 실행

1. 프로젝트 클론
```bash
git clone [repository-url]
cd INET
```

2. 의존성 설치
```bash
./gradlew build
```

3. 애플리케이션 실행
```bash
./gradlew bootRun
```

## QR 코드 생성 기능 사용법

1. 메인 페이지에서 "QR 코드 생성" 카드 클릭
2. 학교 선택 드롭다운에서 원하는 학교 선택
3. "QR 코드 엑셀 다운로드" 버튼 클릭
4. 생성된 엑셀 파일이 자동으로 다운로드됨

## 권한 관리

QR 코드 생성 기능을 사용하려면 관리자가 해당 사용자에게 `QR_CODE_GENERATION` 권한을 부여해야 합니다.

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

