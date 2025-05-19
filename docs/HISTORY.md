# 프로젝트 작업 히스토리

이 문서는 AI 어시스턴트가 이전 작업 내용을 참고하기 위한 히스토리입니다.
각 작업은 순서대로 정리되어 있으며, 코드 변경과 관련된 중요한 정보를 포함합니다.

## 히스토리 작성 가이드
새로운 작업 추가 시 다음 형식을 따릅니다:

1. 항상 최신 작업을 맨 위에 추가합니다.
2. 작업 순서는 실제 진행 순서대로 번호를 매깁니다.
3. 연관된 작업들은 하위 작업으로 구분하여 표시합니다.

```markdown
### N. 작업 분류 (예: 데이터베이스, 버그 수정, 기능 개선 등)
- 작업 제목
  - 작업 순서: N번째 작업
  - 세부 작업 내용
  - 변경사항:
    ```java/sql/css 등
    실제 코드
    ```
  - 영향 받은 파일 (수정 순서대로):
    1. 파일1.java
    2. 파일2.java
  - 하위 작업 (있는 경우):
    1. 첫 번째 하위 작업
    2. 두 번째 하위 작업
```

---

## 최근 작업 내역

### 1. 데이터베이스 초기화
- 자인중학교 데이터 초기화 완료
  - 삭제된 데이터:
    ```sql
    device: 119개
    classroom: 11개
    operator: 16개
    manage: 8개
    uid: 119개
    school: 유지 (삭제하지 않음)
    ```
  - 참고: school 테이블의 데이터는 유지해야 함

### 2. 버그 수정
- 교실 중복 등록 문제 해결
  - 문제: 다른 학교의 동일한 교실명이 등록되지 않는 현상
  - 해결: 
    ```java
    // ClassroomRepository에 메서드 추가
    Optional<Classroom> findByRoomNameAndSchool(String roomName, School school);
    ```
  - 영향 받은 파일 (수정 순서대로):
    - ClassroomRepository.java
    - ClassroomService.java
    - DeviceService.java (엑셀 업로드 부분)

### 3. 기능 개선
- 페이지네이션 개선
  - 변경: 페이지당 표시 항목 수 10개 → 16개
  - 위치: DeviceController.java의 list 메서드
  ```java
  @GetMapping("/list")
  public String list(..., @RequestParam(defaultValue = "16") int size, ...)
  ```

### 4. UI/UX 개선
- 푸터 디자인 최적화
  - 변경사항:
    ```css
    .footer {
      padding: 1rem 0;
      font-size: 0.75rem;
    }
    .footer-logo {
      font-size: 1rem;
    }
    ```

### 5. 개발 환경
- Spring Boot DevTools 설정 추가
  - build.gradle:
    ```gradle
    developmentOnly 'org.springframework.boot:spring-boot-devtools'
    ```
  - application.properties:
    ```properties
    spring.devtools.restart.enabled=true
    spring.devtools.livereload.enabled=true
    spring.thymeleaf.cache=false
    ```
  - 추가된 기능:
    - 코드 변경 시 자동 재시작
    - 정적 리소스 변경 감지
    - LiveReload 지원

## 참고사항
1. 교실 관련 작업 시 항상 학교 정보 확인 필요
2. 데이터 삭제 시 school 테이블 데이터 보존 필수
3. 자동 재시작 기능 활성화 상태

## 다음 작업 예정
- [ ] 엑셀 업로드 시 교실 중복 체크 로직 추가 테스트 필요
- [ ] LiveReload 기능 브라우저 확장 프로그램 설치 가이드 작성 필요 