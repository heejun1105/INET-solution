# 평면도 시스템 (재구축 버전)

## 개요

평면도 시스템이 전면 재구축되어 안정성, 유지보수성, 성능이 크게 개선되었습니다.

## 아키텍처

### 핵심 모듈 (5개)

```
core/
├── FloorPlanCore.js         # 캔버스 엔진 및 상태 관리
├── InteractionManager.js    # 사용자 입력 통합 (드래그/줌/팬)
├── ElementManager.js         # 요소 CRUD 및 레이어 관리
├── DataSyncManager.js        # 서버 동기화 및 저장/로드
└── UIManager.js              # UI 통합 (툴바/모달/알림)
```

### 변경 사항

**기존 (20개 모듈)**
- AutoExpandManager, CanvasRenderer, DesignModeManager, DragManager, DragPreviewManager, FloorPlanManager, FloorplanViewer, GroupDragManager, InfiniteCanvasManager, LODManager, MultiSelectManager, NameBoxManager, PanManager, ResizeManager, ScrollFixManager, SelectionBoxManager, SnapManager, UnplacedRoomsManager, ZoomManager 등

**신규 (5개 모듈)**
- **FloorPlanCore**: 모든 상태와 렌더링 통합
- **InteractionManager**: 모든 입력 처리 통합 (충돌 방지)
- **ElementManager**: 요소 관리 전담
- **DataSyncManager**: 서버 통신 전담
- **UIManager**: UI 관리 전담

## 주요 개선 사항

### 1. 캔버스 안정화

#### 드래그 안정화
- 명확한 상태 관리 (isDragging, isPanning 플래그)
- 이벤트 충돌 방지
- 그룹 드래그 시 좌표 계산 정확성 보장

#### 줌/팬 안정화
- 마우스 위치 기준 줌 (중심점 고정)
- 줌 레벨 제한 (0.1 ~ 5.0)
- 스페이스바 + 드래그로 팬
- 마우스 휠로 줌

#### 좌표계 표준화
```javascript
// 모든 좌표 변환이 한 곳에서 처리
screenToCanvas(x, y)  // 화면 → 캔버스
canvasToScreen(x, y)  // 캔버스 → 화면
```

### 2. 데이터 무결성

#### 저장/로드 안정화
- 저장 전 검증 (validateBeforeSave)
- 로드 후 검증 (validateAfterLoad)
- 임시 ID 처리 로직 개선
- 재시도 메커니즘 (최대 3회, 지수 백오프)

#### 버전 관리
- 낙관적 락 (@Version)
- 동시 수정 감지

### 3. 성능 향상

#### 렌더링 최적화
- 변경 시에만 렌더링 (isDirty 플래그)
- requestAnimationFrame 사용
- 불필요한 렌더링 최소화

#### 데이터베이스 최적화
- 인덱스 추가 (school_id, element_type, reference_id)
- N+1 문제 해결
- 배치 조회

### 4. 유지보수성

#### 명확한 책임 분리
- 각 모듈이 하나의 역할만 담당
- 의존성 최소화
- 테스트 가능한 구조

#### 일관된 명명 규칙
- `x_screen`, `x_canvas` (좌표계 명확히)
- `handle*`, `on*`, `update*`, `render*` (메서드 패턴)
- 상수는 대문자 (`MIN_ZOOM`, `MAX_ZOOM`)

#### 문서화
- 각 모듈 상단에 목적/책임 명시
- JSDoc 타입 주석
- 단계별 주석

## 사용법

### 설계 모드 진입

```javascript
const app = new FloorPlanApplication();
app.init();
app.enterDesignMode();
```

### 학교 선택 후 평면도 로드

```javascript
// 자동으로 학교 선택 모달 표시
// 학교 선택 시 자동으로 평면도 로드
```

### 요소 추가

```javascript
app.elementManager.createElement('room', {
    xCoordinate: 100,
    yCoordinate: 100,
    width: 120,
    height: 80,
    label: '3-1'
});
```

### 저장

```javascript
await app.dataSyncManager.save(schoolId);
```

## API

### RESTful 엔드포인트

```
GET    /floorplan/api/schools/{schoolId}           # 평면도 조회
PUT    /floorplan/api/schools/{schoolId}           # 평면도 저장
DELETE /floorplan/api/schools/{schoolId}           # 평면도 삭제
GET    /floorplan/api/schools/{schoolId}/exists    # 평면도 존재 확인
```

### 하위 호환성 API (기존 코드 지원)

```
GET    /floorplan/load?schoolId={id}
POST   /floorplan/save?schoolId={id}
GET    /floorplan/exists?schoolId={id}
DELETE /floorplan/delete?schoolId={id}
```

## 단축키

- `V`: 선택 모드
- `Space`: 팬 모드 (누르고 드래그)
- `Ctrl/Cmd + S`: 저장
- `Ctrl/Cmd + Z`: 실행 취소 (예정)
- `Ctrl/Cmd + Y`: 다시 실행 (예정)
- `Ctrl/Cmd + A`: 전체 선택
- `Delete/Backspace`: 선택 삭제
- `Escape`: 선택 해제

## 마이그레이션

### 데이터베이스 마이그레이션

```sql
-- floorplan_enhancement.sql 실행
source src/main/resources/db/migration/floorplan_enhancement.sql;
```

### 기존 데이터 호환성

- 기존 평면도 데이터는 자동으로 로드됨
- 새 필드는 기본값으로 초기화됨
- JSON 데이터는 여전히 `elementData`에 저장됨

## 문제 해결

### 드래그가 안 될 때

- 브라우저 콘솔 확인
- `isDragging` 상태 확인
- 이벤트 리스너 등록 확인

### 저장이 안 될 때

- 네트워크 탭 확인
- 권한 확인
- 데이터 검증 에러 확인

### 렌더링이 안 될 때

- `isDirty` 플래그 확인
- `requestAnimationFrame` 동작 확인
- 캔버스 크기 확인

## 향후 계획

- [ ] 실행 취소/다시 실행 (History Manager)
- [ ] 요소 회전 UI
- [ ] 요소 그룹화 UI
- [ ] 레이어 패널
- [ ] 스냅 가이드라인
- [ ] 미니맵
- [ ] 키보드 단축키 커스터마이징
- [ ] 테마 지원
- [ ] 모바일 터치 지원

## 기여

코드 수정 시 다음 원칙을 따라주세요:

1. 단일 책임 원칙
2. 명확한 명명
3. JSDoc 주석
4. 에러 처리
5. 로깅 (console.debug/log/error)

## 라이선스

내부 프로젝트

