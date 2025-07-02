/**
 * 학교 평면도 관리 시스템
 * 건물, 층, 교실 설계 및 장비/무선AP 배치 관리
 */

/**
 * 크기 조절 관리 클래스
 */
class ResizeManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.isResizing = false;
        this.selectedElement = null;
        this.resizeHandle = null;
        this.startPos = { x: 0, y: 0 };
        this.startSize = { width: 0, height: 0 };
        this.startElementPos = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.minSize = { width: 50, height: 30 }; // 최소 크기
    }

    addResizeHandles(element) {
        // 기존 핸들 제거
        this.removeResizeHandles(element);
        
        const handlesContainer = document.createElement('div');
        handlesContainer.className = 'resize-handles';
        
        const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
        
        handles.forEach(direction => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${direction}`;
            handle.dataset.direction = direction;
            
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startResize(e, element, direction);
            });
            
            handlesContainer.appendChild(handle);
        });
        
        element.appendChild(handlesContainer);
        
        // 마우스 이벤트 바인딩
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    removeResizeHandles(element) {
        const existingHandles = element.querySelector('.resize-handles');
        if (existingHandles) {
            existingHandles.remove();
        }
    }

    startResize(e, element, direction) {
        e.preventDefault();
        
        this.isResizing = true;
        this.resizeHandle = direction;
        this.selectedElement = element;
        
        this.startPos = { x: e.clientX, y: e.clientY };
        
        const rect = element.getBoundingClientRect();
        const canvas = document.getElementById('canvasContent');
        const canvasRect = canvas.getBoundingClientRect();
        
        this.startElementPos = {
            x: rect.left - canvasRect.left,
            y: rect.top - canvasRect.top,
            width: rect.width,
            height: rect.height
        };
        
        document.body.style.cursor = getComputedStyle(e.target).cursor;
        document.body.style.userSelect = 'none';
    }

    handleMouseMove(e) {
        if (!this.isResizing) return;
        
        const deltaX = e.clientX - this.startPos.x;
        const deltaY = e.clientY - this.startPos.y;
        
        let newRect = { ...this.startElementPos };
        
        switch (this.resizeHandle) {
            case 'nw':
                newRect.x += deltaX;
                newRect.y += deltaY;
                newRect.width -= deltaX;
                newRect.height -= deltaY;
                break;
            case 'ne':
                newRect.y += deltaY;
                newRect.width += deltaX;
                newRect.height -= deltaY;
                break;
            case 'sw':
                newRect.x += deltaX;
                newRect.width -= deltaX;
                newRect.height += deltaY;
                break;
            case 'se':
                newRect.width += deltaX;
                newRect.height += deltaY;
                break;
            case 'n':
                newRect.y += deltaY;
                newRect.height -= deltaY;
                break;
            case 's':
                newRect.height += deltaY;
                break;
            case 'w':
                newRect.x += deltaX;
                newRect.width -= deltaX;
                break;
            case 'e':
                newRect.width += deltaX;
                break;
        }
        
        // 최소 크기 제한
        if (newRect.width < this.minSize.width) {
            if (this.resizeHandle.includes('w')) {
                newRect.x = this.startElementPos.x + this.startElementPos.width - this.minSize.width;
            }
            newRect.width = this.minSize.width;
        }
        
        if (newRect.height < this.minSize.height) {
            if (this.resizeHandle.includes('n')) {
                newRect.y = this.startElementPos.y + this.startElementPos.height - this.minSize.height;
            }
            newRect.height = this.minSize.height;
        }
        
        // 스냅 기능 적용 (위치 조정만)
        const snappedPosition = this.floorPlanManager.snapManager.snapElement(
            this.selectedElement, 
            newRect.x, 
            newRect.y
        );
        
        // 크기 변경 적용
        this.selectedElement.style.left = snappedPosition.x + 'px';
        this.selectedElement.style.top = snappedPosition.y + 'px';
        this.selectedElement.style.width = newRect.width + 'px';
        this.selectedElement.style.height = newRect.height + 'px';
    }

    handleMouseUp(e) {
        if (!this.isResizing) return;
        
        // 스냅 피드백 제거
        if (this.selectedElement) {
            this.floorPlanManager.snapManager.hideSnapFeedback(this.selectedElement);
        }
        
        this.isResizing = false;
        this.resizeHandle = null;
        this.selectedElement = null;
        
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // 크기 변경 완료 이벤트 발생
        const resizeCompleteEvent = new CustomEvent('resizeComplete', {
            detail: { element: this.selectedElement }
        });
        document.dispatchEvent(resizeCompleteEvent);
    }
}

/**
 * 스냅(자석) 기능 관리 클래스
 */
class SnapManager {
    constructor() {
        this.snapDistance = 15; // 스냅 거리 (픽셀)
    }

    /**
     * 요소를 다른 요소들에 스냅시킵니다
     */
    snapElement(element, targetX, targetY) {
        const elementType = element.dataset.type;
        const allElements = document.querySelectorAll('.building, .room');
        const otherElements = Array.from(allElements).filter(el => el !== element);
        
        if (otherElements.length === 0) {
            return { x: targetX, y: targetY };
        }

        const elementRect = {
            x: targetX,
            y: targetY,
            width: parseInt(element.style.width) || 100,
            height: parseInt(element.style.height) || 80,
            get right() { return this.x + this.width; },
            get bottom() { return this.y + this.height; }
        };

        let snappedX = targetX;
        let snappedY = targetY;
        let hasSnapped = false;

        // 다른 요소들과 스냅 체크
        for (const otherElement of otherElements) {
            const otherRect = this.getElementRect(otherElement);
            
            // 수평 스냅 체크
            const snapResult = this.checkSnap(elementRect, otherRect);
            if (snapResult.snapped) {
                if (snapResult.x !== null) {
                    snappedX = snapResult.x;
                    hasSnapped = true;
                }
                if (snapResult.y !== null) {
                    snappedY = snapResult.y;
                    hasSnapped = true;
                }
            }
        }

        // 스냅된 경우 시각적 피드백
        if (hasSnapped) {
            this.showSnapFeedback(element);
        } else {
            this.hideSnapFeedback(element);
        }

        return { x: snappedX, y: snappedY };
    }

    /**
     * 두 사각형 간의 스냅 가능성 체크
     */
    checkSnap(rect1, rect2) {
        let snappedX = null;
        let snappedY = null;
        let snapped = false;

        // 수직 정렬 여부 확인 (Y축 겹침)
        const verticalOverlap = !(rect1.bottom < rect2.y || rect1.y > rect2.bottom);
        
        // 수평 정렬 여부 확인 (X축 겹침)
        const horizontalOverlap = !(rect1.right < rect2.x || rect1.x > rect2.right);

        if (verticalOverlap) {
            // 좌측 경계 스냅: rect1의 오른쪽이 rect2의 왼쪽에
            if (Math.abs(rect1.right - rect2.x) <= this.snapDistance) {
                snappedX = rect2.x - rect1.width;
                snapped = true;
            }
            // 우측 경계 스냅: rect1의 왼쪽이 rect2의 오른쪽에
            else if (Math.abs(rect1.x - rect2.right) <= this.snapDistance) {
                snappedX = rect2.right;
                snapped = true;
            }
            // 중앙 정렬 스냅
            else if (Math.abs(rect1.x - rect2.x) <= this.snapDistance) {
                snappedX = rect2.x;
                snapped = true;
            }
            else if (Math.abs(rect1.right - rect2.right) <= this.snapDistance) {
                snappedX = rect2.right - rect1.width;
                snapped = true;
            }
        }

        if (horizontalOverlap) {
            // 상단 경계 스냅: rect1의 하단이 rect2의 상단에
            if (Math.abs(rect1.bottom - rect2.y) <= this.snapDistance) {
                snappedY = rect2.y - rect1.height;
                snapped = true;
            }
            // 하단 경계 스냅: rect1의 상단이 rect2의 하단에
            else if (Math.abs(rect1.y - rect2.bottom) <= this.snapDistance) {
                snappedY = rect2.bottom;
                snapped = true;
            }
            // 중앙 정렬 스냅
            else if (Math.abs(rect1.y - rect2.y) <= this.snapDistance) {
                snappedY = rect2.y;
                snapped = true;
            }
            else if (Math.abs(rect1.bottom - rect2.bottom) <= this.snapDistance) {
                snappedY = rect2.bottom - rect1.height;
                snapped = true;
            }
        }

        return { snapped, x: snappedX, y: snappedY };
    }

    /**
     * 요소의 위치와 크기 정보 반환
     */
    getElementRect(element) {
        const style = element.style;
        return {
            x: parseInt(style.left) || 0,
            y: parseInt(style.top) || 0,
            width: parseInt(style.width) || 100,
            height: parseInt(style.height) || 80,
            get right() { return this.x + this.width; },
            get bottom() { return this.y + this.height; }
        };
    }

    /**
     * 스냅 시각적 피드백 표시
     */
    showSnapFeedback(element) {
        element.style.boxShadow = '0 0 10px #007bff';
        element.style.borderColor = '#007bff';
    }

    /**
     * 스냅 시각적 피드백 숨기기
     */
    hideSnapFeedback(element) {
        element.style.boxShadow = '';
        element.style.borderColor = '';
    }

    /**
     * 그리드에 스냅
     */
    snapToGrid(x, y, gridSize = 10) {
        return {
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize
        };
    }
}

// 확대/축소 관리 클래스
class ZoomManager {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.zoomLevel = 1.0;
        this.minZoom = 0.25; // 최소 25%
        this.maxZoom = 3.0;  // 최대 300%
        this.zoomStep = 0.25; // 확대/축소 단계
        
        this.initEventListeners();
        this.updateZoomDisplay();
    }
    
    initEventListeners() {
        // 확대 버튼
        document.getElementById('zoomIn').addEventListener('click', () => {
            this.zoomIn();
        });
        
        // 축소 버튼
        document.getElementById('zoomOut').addEventListener('click', () => {
            this.zoomOut();
        });
        
        // 원래 크기 버튼
        document.getElementById('zoomReset').addEventListener('click', () => {
            this.resetZoom();
        });
        
        // 마우스 휠 확대/축소 비활성화 (버튼으로만 가능)
        // this.canvas.addEventListener('wheel', (e) => {
        //     e.preventDefault();
        //     
        //     if (e.deltaY < 0) {
        //         this.zoomIn();
        //     } else {
        //         this.zoomOut();
        //     }
        // });
        
        // 키보드 단축키 (Ctrl + +/-)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    this.zoomIn();
                } else if (e.key === '-') {
                    e.preventDefault();
                    this.zoomOut();
                } else if (e.key === '0') {
                    e.preventDefault();
                    this.resetZoom();
                }
            }
        });
    }
    
    zoomIn() {
        const newZoom = Math.min(this.zoomLevel + this.zoomStep, this.maxZoom);
        this.setZoom(newZoom);
    }
    
    zoomOut() {
        const newZoom = Math.max(this.zoomLevel - this.zoomStep, this.minZoom);
        this.setZoom(newZoom);
    }
    
    resetZoom() {
        this.setZoom(1.0);
    }
    
    setZoom(level) {
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, level));
        this.applyZoom();
        this.updateZoomDisplay();
        this.updateButtonStates();
    }
    
    applyZoom() {
        this.canvas.style.transform = `scale(${this.zoomLevel})`;
        
        // 확대/축소 시 캔버스 크기 동적 조정
        const container = this.canvas.parentElement;
        const baseWidth = container.offsetWidth;
        const baseHeight = Math.max(500, container.offsetHeight);
        
        // 확대 시 더 큰 영역을 제공하고, 축소 시 작은 영역 제공
        const adjustedWidth = baseWidth / this.zoomLevel;
        const adjustedHeight = baseHeight / this.zoomLevel;
        
        this.canvas.style.width = `${adjustedWidth}px`;
        this.canvas.style.height = `${adjustedHeight}px`;
        this.canvas.style.minWidth = `${adjustedWidth}px`;
        this.canvas.style.minHeight = `${adjustedHeight}px`;
    }
    
    updateZoomDisplay() {
        const percentage = Math.round(this.zoomLevel * 100);
        document.getElementById('zoomLevel').textContent = `${percentage}%`;
    }
    
    updateButtonStates() {
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        
        // 최대 확대 시 확대 버튼 비활성화
        if (this.zoomLevel >= this.maxZoom) {
            zoomInBtn.style.opacity = '0.5';
            zoomInBtn.style.cursor = 'not-allowed';
        } else {
            zoomInBtn.style.opacity = '1';
            zoomInBtn.style.cursor = 'pointer';
        }
        
        // 최소 축소 시 축소 버튼 비활성화
        if (this.zoomLevel <= this.minZoom) {
            zoomOutBtn.style.opacity = '0.5';
            zoomOutBtn.style.cursor = 'not-allowed';
        } else {
            zoomOutBtn.style.opacity = '1';
            zoomOutBtn.style.cursor = 'pointer';
        }
    }
    
    // 현재 줌 레벨 반환
    getCurrentZoom() {
        return this.zoomLevel;
    }
    
    // 캔버스 좌표 계산 메서드 - 동적 변화를 정확히 반영
    getCanvasCoordinates(e) {
        const canvas = this.canvas;
        
        // 매번 최신 상태로 getBoundingClientRect() 호출
        const rect = canvas.getBoundingClientRect();
        
        // 캔버스 내부의 스크롤 상태 확인
        const scrollLeft = canvas.scrollLeft || 0;
        const scrollTop = canvas.scrollTop || 0;
        
        // 부모 컨테이너들의 스크롤 확인
        let parentScrollX = 0;
        let parentScrollY = 0;
        let parent = canvas.parentElement;
        while (parent && parent !== document.body) {
            parentScrollX += parent.scrollLeft || 0;
            parentScrollY += parent.scrollTop || 0;
            parent = parent.parentElement;
        }
        
        // 기본 상대 좌표 계산
        let relativeX = e.clientX - rect.left;
        let relativeY = e.clientY - rect.top;
        
        // 스크롤 보정
        relativeX += scrollLeft + parentScrollX;
        relativeY += scrollTop + parentScrollY;
        
        // 줌 레벨 적용
        const adjustedX = relativeX / this.zoomLevel;
        const adjustedY = relativeY / this.zoomLevel;
        
        console.log('🎯 정밀한 좌표 계산 (실시간):', {
            mouse: { clientX: e.clientX, clientY: e.clientY },
            canvasBounds: { 
                left: rect.left, 
                top: rect.top, 
                width: rect.width, 
                height: rect.height 
            },
            scrollInfo: {
                canvas: { left: scrollLeft, top: scrollTop },
                parent: { x: parentScrollX, y: parentScrollY }
            },
            beforeZoom: { x: relativeX, y: relativeY },
            zoomLevel: this.zoomLevel,
            finalCoords: { x: adjustedX, y: adjustedY },
            existingElements: {
                buildings: document.querySelectorAll('.building').length,
                rooms: document.querySelectorAll('.room').length
            }
        });
        
        return { x: adjustedX, y: adjustedY };
    }
}

class DragManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.isDragging = false;
        this.dragElement = null;
        this.offset = { x: 0, y: 0 };
    }
    
    startDrag(element, e) {
        this.isDragging = true;
        this.dragElement = element;
        
        // 줌 적용된 좌표로 변환
        const canvasCoords = this.floorPlanManager.zoomManager.getCanvasCoordinates(e);
        const elementRect = element.getBoundingClientRect();
        const elementX = parseInt(element.style.left || 0);
        const elementY = parseInt(element.style.top || 0);
        
        this.offset = {
            x: canvasCoords.x - elementX,
            y: canvasCoords.y - elementY
        };
        
        element.style.zIndex = '1000';
        e.preventDefault();
        e.stopPropagation();
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.dragElement) return;
        
        // 줌 적용된 좌표로 변환
        const canvasCoords = this.floorPlanManager.zoomManager.getCanvasCoordinates(e);
        const targetX = canvasCoords.x - this.offset.x;
        const targetY = canvasCoords.y - this.offset.y;
        
        // 스냅 기능으로 위치 조정
        const snappedPosition = this.floorPlanManager.snapManager.snapElement(
            this.dragElement, 
            targetX, 
            targetY
        );
        
        this.dragElement.style.left = snappedPosition.x + 'px';
        this.dragElement.style.top = snappedPosition.y + 'px';
        
        e.preventDefault();
    }
    
    handleMouseUp(e) {
        if (this.isDragging && this.dragElement) {
            this.dragElement.style.zIndex = '';
            this.isDragging = false;
        }
    }
}

class FloorPlanManager {
    constructor() {
        this.currentSchoolId = null;
        this.currentMode = 'layout'; // layout, device, wireless
        this.currentTool = 'select';
        this.selectedElement = null;
        this.floorPlanData = {
            buildings: [],
            rooms: [],
            seats: [],
            deviceLocations: [],
            wirelessApLocations: []
        };
        this.resizeManager = new ResizeManager(this); // 크기 조절 관리자 추가
        this.snapManager = new SnapManager(); // 스냅 기능 관리자 추가
        this.zoomManager = new ZoomManager(document.getElementById('canvasContent')); // 확대/축소 관리자 추가
        this.dragManager = new DragManager(this); // DragManager 인스턴스 추가
        this.unplacedRoomsManager = new UnplacedRoomsManager(this); // 미배치 교실 관리자 추가
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.setupCanvas();
    }
    
    bindEvents() {
        // 모드 전환 버튼들
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.switchMode(mode);
            });
        });

        // 도구 버튼들 - 원클릭 방식으로 변경
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tool = e.target.closest('.tool-button').dataset.tool;
                this.handleToolClick(tool);
            });
        });

        // 학교 선택
        const schoolSelect = document.getElementById('schoolSelect');
        if (schoolSelect) {
            schoolSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.selectSchool(e.target.value);
                }
            });
        }

        // 저장/다운로드 버튼들
        const saveButton = document.getElementById('saveFloorPlan');
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveFloorPlan());
        }

        const downloadButton = document.getElementById('downloadPPT');
        if (downloadButton) {
            downloadButton.addEventListener('click', () => this.downloadPPT());
        }

        // PPT 다운로드 버튼
        document.getElementById('downloadButton').addEventListener('click', () => {
            this.downloadPPT();
        });
        
        // 캔버스 이벤트
        this.setupCanvasEvents();
    }
    
    setupCanvas() {
        const canvas = document.getElementById('canvasContent');
        
        if (!canvas) {
            console.error('캔버스 요소를 찾을 수 없습니다!');
            return;
        }
        
        canvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e);
        });
        canvas.addEventListener('contextmenu', (e) => this.handleRightClick(e));
    }
    
    setupCanvasEvents() {
        // 전역 마우스 이벤트 (드래그용)
        document.addEventListener('mousemove', (e) => {
            this.dragManager.handleMouseMove(e);
            this.resizeManager.handleMouseMove(e);
        });
        
        document.addEventListener('mouseup', (e) => {
            this.dragManager.handleMouseUp(e);
            this.resizeManager.handleMouseUp(e);
        });
        
        // 터치 이벤트 (모바일 지원)
        const canvas = document.getElementById('canvasContent');
        canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }
    
    selectSchool(schoolId) {
        if (!schoolId) {
            this.currentSchoolId = null;
            this.clearCanvas();
            this.unplacedRoomsManager.unplacedRooms = [];
            this.unplacedRoomsManager.renderUnplacedRooms();
            return;
        }
        
        this.currentSchoolId = schoolId;
        this.loadFloorPlanData(schoolId);
        this.unplacedRoomsManager.loadUnplacedRooms(schoolId); // 미배치 교실 로드
    }
    
    switchMode(mode) {
        this.currentMode = mode;
        
        // 탭 버튼 활성화
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
        
        // 도구 모음 전환
        document.querySelectorAll('.toolbar').forEach(toolbar => {
            toolbar.classList.remove('active');
        });
        document.getElementById(`${mode}Toolbar`).classList.add('active');
        
        // 모드별 캔버스 업데이트
        this.updateCanvasForMode();
    }
    
    selectTool(tool) {
        this.currentTool = tool;
        
        // 도구 버튼 활성화
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const targetButton = document.querySelector(`[data-tool="${tool}"]`);
        
        if (targetButton) {
            targetButton.classList.add('active');
        }
        
        // 캔버스 커서 변경
        this.updateCanvasCursor();
        
        // 도구 선택 시 안내 메시지 표시
        switch (tool) {
            case 'building':
                this.showNotification('캔버스에서 원하는 위치를 클릭하여 건물을 배치하세요.', 'info');
                break;
            case 'room':
                this.showNotification('캔버스에서 원하는 위치를 클릭하여 교실을 배치하세요.', 'info');
                break;
            case 'add-ap':
                this.showNotification('교실 내부를 클릭하여 무선AP를 배치하세요.', 'info');
                break;
            case 'delete':
                this.showNotification('삭제할 요소를 클릭하세요.', 'info');
                break;
        }
    }
    
    updateCanvasCursor() {
        const canvas = document.getElementById('canvasContent');
        
        switch (this.currentTool) {
            case 'select':
                canvas.style.cursor = 'default';
                break;
            case 'building':
                canvas.style.cursor = 'crosshair';
                break;
            case 'room':
                canvas.style.cursor = 'crosshair';
                break;
            case 'add-ap':
                canvas.style.cursor = 'crosshair';
                break;
            case 'delete':
                canvas.style.cursor = 'not-allowed';
                break;
            case 'copy':
                canvas.style.cursor = 'copy';
                break;
            default:
                canvas.style.cursor = 'default';
        }
    }
    
    async loadFloorPlanData(schoolId) {
        try {
            const response = await fetch(`/floorplan/api/school/${schoolId}`);
            if (response.ok) {
                this.floorPlanData = await response.json();
                this.renderFloorPlan();
                this.showNotification('평면도 데이터를 불러왔습니다.');
            } else {
                this.showNotification('평면도 데이터 로딩에 실패했습니다.', 'error');
            }
        } catch (error) {
            console.error('평면도 데이터 로딩 오류:', error);
            this.showNotification('평면도 데이터 로딩 중 오류가 발생했습니다.', 'error');
        }
    }
    
    renderFloorPlan() {
        this.clearCanvas();
        
        switch (this.currentMode) {
            case 'layout':
                this.renderLayoutMode();
                break;
            case 'device':
                this.renderDeviceMode();
                break;
            case 'wireless':
                this.renderWirelessMode();
                break;
        }
    }
    
    renderLayoutMode() {
        const canvas = document.getElementById('canvasContent');
        
        // 건물 렌더링
        if (this.floorPlanData.buildings) {
            this.floorPlanData.buildings.forEach(building => {
                this.renderBuilding(building);
            });
        }
        
        // 교실 렌더링 (건물에 속한 교실 + 독립 교실)
        if (this.floorPlanData.rooms) {
            this.floorPlanData.rooms.forEach(room => {
                this.renderRoom(room);
            });
        }
    }
    
    renderDeviceMode() {
        // 기본 구조는 동일하게 렌더링하고 장비 정보만 추가
        this.renderLayoutMode();
        this.renderDeviceIcons();
    }
    
    renderWirelessMode() {
        // 기본 구조 렌더링 후 무선AP 표시
        this.renderLayoutMode();
        this.renderWirelessAPs();
    }
    
    renderBuilding(building) {
        console.log('renderBuilding 시작:', building);
        
        const canvas = document.getElementById('canvasContent');
        console.log('캔버스 요소:', canvas);
        
        if (!canvas) {
            console.error('캔버스 요소를 찾을 수 없습니다!');
            return;
        }
        
        const buildingElement = document.createElement('div');
        buildingElement.className = 'draggable building';
        buildingElement.dataset.type = 'building';
        buildingElement.dataset.id = building.buildingId || 'new';
        buildingElement.textContent = building.buildingName || '새 건물';
        
        buildingElement.style.left = (building.xCoordinate || 50) + 'px';
        buildingElement.style.top = (building.yCoordinate || 50) + 'px';
        buildingElement.style.width = (building.width || 200) + 'px';
        buildingElement.style.height = (building.height || 300) + 'px';
        
        console.log('건물 요소 생성됨:', {
            className: buildingElement.className,
            style: {
                left: buildingElement.style.left,
                top: buildingElement.style.top,
                width: buildingElement.style.width,
                height: buildingElement.style.height
            }
        });
        
        // 이벤트 리스너 추가
        this.addElementEvents(buildingElement);
        
        canvas.appendChild(buildingElement);
        console.log('캔버스에 건물 요소 추가 완료');
        console.log('캔버스의 자식 요소 개수:', canvas.children.length);
    }
    
    renderDeviceIcons() {
        // 교실별 장비 아이콘 표시
        document.querySelectorAll('.room').forEach(roomElement => {
            const roomId = roomElement.dataset.id;
            if (roomId && roomId !== 'new') {
                this.loadAndDisplayDeviceIcons(roomId, roomElement);
            }
        });
    }
    
    async loadAndDisplayDeviceIcons(roomId, roomElement) {
        try {
            const response = await fetch(`/floorplan/api/room/${roomId}/devices`);
            if (response.ok) {
                const deviceCounts = await response.json();
                this.displayDeviceIcons(roomElement, deviceCounts);
            }
        } catch (error) {
            console.error('장비 정보 로딩 오류:', error);
        }
    }
    
    displayDeviceIcons(roomElement, deviceCounts) {
        // 기존 장비 아이콘 제거
        const existingIcons = roomElement.querySelector('.device-icons');
        if (existingIcons) {
            existingIcons.remove();
        }
        
        // 새 장비 아이콘 추가
        const iconsContainer = document.createElement('div');
        iconsContainer.className = 'device-icons';
        
        Object.entries(deviceCounts).forEach(([type, count]) => {
            if (count > 0) {
                const iconElement = document.createElement('div');
                iconElement.className = 'device-icon';
                iconElement.innerHTML = `${this.getDeviceIcon(type)} ${count}`;
                iconsContainer.appendChild(iconElement);
            }
        });
        
        roomElement.appendChild(iconsContainer);
    }
    
    getDeviceIcon(deviceType) {
        const iconMap = {
            '모니터': '<i class="fas fa-desktop"></i>',
            '노트북': '<i class="fas fa-laptop"></i>',
            '태블릿': '<i class="fas fa-tablet-alt"></i>',
            '프린터': '<i class="fas fa-print"></i>',
            '스피커': '<i class="fas fa-volume-up"></i>',
            '카메라': '<i class="fas fa-camera"></i>',
            '키보드': '<i class="fas fa-keyboard"></i>',
            '마우스': '<i class="fas fa-mouse"></i>',
            'default': '<i class="fas fa-microchip"></i>'
        };
        
        return iconMap[deviceType] || iconMap.default;
    }
    
    renderWirelessAPs() {
        // 무선AP 위치 표시
        if (this.floorPlanData.apsByRoom) {
            Object.entries(this.floorPlanData.apsByRoom).forEach(([roomId, aps]) => {
                aps.forEach(ap => {
                    this.renderWirelessAP(ap, roomId);
                });
            });
        }
    }
    
    renderWirelessAP(ap, roomId) {
        const roomElement = document.querySelector(`[data-id="${roomId}"]`);
        if (!roomElement) return;
        
        const apElement = document.createElement('div');
        apElement.className = 'wireless-ap draggable';
        apElement.dataset.type = 'wireless-ap';
        apElement.dataset.id = ap.apLocationId || 'new';
        apElement.dataset.roomId = roomId;
        apElement.innerHTML = '<i class="fas fa-wifi"></i>';
        
        apElement.style.left = (ap.xCoordinate || 50) + 'px';
        apElement.style.top = (ap.yCoordinate || 40) + 'px';
        apElement.style.width = ((ap.radius || 8) * 2) + 'px';
        apElement.style.height = ((ap.radius || 8) * 2) + 'px';
        apElement.style.backgroundColor = ap.color || '#ef4444';
        
        // 상대 위치로 배치 (부모 교실 기준)
        apElement.style.position = 'absolute';
        
        roomElement.appendChild(apElement);
        this.addElementEvents(apElement);
    }
    
    addElementEvents(element) {
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectElement(element);
        });
        
        element.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editElement(element);
        });
        
        // 크기 조절 핸들 추가
        this.resizeManager.addResizeHandles(element);
        
        // 드래그 기능을 위한 마우스 이벤트
        element.addEventListener('mousedown', (e) => {
            // 크기 조절 핸들 클릭이 아닌 경우에만 드래그 시작
            if (!e.target.classList.contains('resize-handle')) {
                this.dragManager.startDrag(element, e);
            }
        });
    }
    
    handleCanvasClick(e) {
        // 요소 클릭이 아닌 캔버스 배경 클릭만 처리
        if (e.target.id !== 'canvasContent') {
            return;
        }
        
        // 새로운 정확한 좌표 계산 메서드 사용
        const coords = this.zoomManager.getCanvasCoordinates(e);
        const x = coords.x;
        const y = coords.y;
        
        console.log('=== 캔버스 클릭 디버깅 ===');
        console.log('마우스 이벤트:', { clientX: e.clientX, clientY: e.clientY });
        console.log('계산된 캔버스 좌표:', { x, y });
        console.log('기존 요소 개수:', {
            buildings: document.querySelectorAll('.building').length,
            rooms: document.querySelectorAll('.room').length
        });
        
        // 클릭 위치에 임시 마커 표시 (디버깅용)
        const marker = document.createElement('div');
        marker.style.position = 'absolute';
        marker.style.left = (x - 5) + 'px';
        marker.style.top = (y - 5) + 'px';
        marker.style.width = '10px';
        marker.style.height = '10px';
        marker.style.background = 'red';
        marker.style.borderRadius = '50%';
        marker.style.zIndex = '9999';
        marker.style.pointerEvents = 'none';
        marker.className = 'debug-marker';
        
        const canvas = document.getElementById('canvasContent');
        canvas.appendChild(marker);
        
        // 2초 후 마커 제거
        setTimeout(() => {
            if (marker.parentNode) {
                marker.parentNode.removeChild(marker);
            }
        }, 2000);
        
        // 현재 도구에 따른 처리
        switch (this.currentTool) {
            case 'building':
                this.createBuilding(x, y);
                // 생성 후 select 도구로 자동 변경
                this.selectTool('select');
                break;
                
            case 'room':
                this.createRoom(x, y);
                // 생성 후 select 도구로 자동 변경
                this.selectTool('select');
                break;
                
            case 'add-ap':
                if (this.currentMode === 'wireless') {
                    this.createWirelessAP(x, y);
                }
                break;
                
            case 'select':
            default:
                // 선택 해제
                this.clearSelection();
                break;
        }
    }
    
    handleRightClick(e) {
        e.preventDefault();
        // 컨텍스트 메뉴 표시 (추후 구현)
    }
    
    createBuilding(x, y) {
        if (!this.currentSchoolId) {
            this.showNotification('먼저 학교를 선택해주세요.', 'error');
            return;
        }
        
        // 마우스 위치가 건물 중심이 되도록 조정 (건물 크기: 200x300)
        const initialX = x - 100; // 너비의 절반
        const initialY = y - 150; // 높이의 절반
        
        const buildingData = {
            buildingName: '새 건물',
            xCoordinate: initialX,
            yCoordinate: initialY,
            width: 200,
            height: 300,
            schoolId: this.currentSchoolId
        };
        
        this.floorPlanData.buildings.push(buildingData);
        this.renderBuilding(buildingData);
        this.showNotification('새 건물이 추가되었습니다.');
    }
    
    createRoom(x, y) {
        if (!this.currentSchoolId) {
            this.showNotification('먼저 학교를 선택해주세요.', 'error');
            return;
        }
        
        // 마우스 위치가 교실 중심이 되도록 조정 (교실 크기: 100x80)
        const initialX = x - 50; // 너비의 절반
        const initialY = y - 40; // 높이의 절반
        
        const roomData = {
            roomName: '새 교실',
            roomType: 'classroom',
            xCoordinate: initialX,
            yCoordinate: initialY,
            width: 100,
            height: 80,
            schoolId: this.currentSchoolId
        };
        
        // 선택된 건물이 있으면 해당 건물에 속하도록, 없으면 독립 교실로 생성
        if (this.selectedElement && this.selectedElement.dataset.type === 'building') {
            roomData.buildingId = this.selectedElement.dataset.id;
            this.showNotification('새 교실이 건물에 추가되었습니다.');
        } else {
            this.showNotification('새 독립 교실이 추가되었습니다.');
        }
        
        // floorPlanData에 추가
        if (!this.floorPlanData.rooms) {
            this.floorPlanData.rooms = [];
        }
        this.floorPlanData.rooms.push(roomData);
        
        // 교실 렌더링
        this.renderRoom(roomData);
    }
    
    renderRoom(room) {
        const canvas = document.getElementById('canvasContent');
        
        const roomElement = document.createElement('div');
        roomElement.className = 'draggable room';
        roomElement.dataset.type = 'room';
        roomElement.dataset.id = room.floorRoomId || 'new';
        
        const roomName = document.createElement('div');
        roomName.className = 'room-name';
        roomName.textContent = room.roomName || '새 교실';
        roomElement.appendChild(roomName);
        
        // 좌표 계산 디버깅
        const finalLeft = room.xCoordinate || 50;
        const finalTop = room.yCoordinate || 50;
        const finalWidth = room.width || 100;
        const finalHeight = room.height || 80;
        
        console.log('🎨 renderRoom 디버깅:', {
            roomName: room.roomName,
            inputCoords: { x: room.xCoordinate, y: room.yCoordinate },
            finalCoords: { left: finalLeft, top: finalTop },
            size: { width: finalWidth, height: finalHeight },
            canvasInfo: {
                id: canvas.id,
                clientRect: canvas.getBoundingClientRect(),
                style: {
                    position: canvas.style.position,
                    transform: canvas.style.transform,
                    marginLeft: canvas.style.marginLeft
                }
            }
        });
        
        roomElement.style.left = finalLeft + 'px';
        roomElement.style.top = finalTop + 'px';
        roomElement.style.width = finalWidth + 'px';
        roomElement.style.height = finalHeight + 'px';
        
        // 요소 추가 후 실제 위치 확인
        this.addElementEvents(roomElement);
        canvas.appendChild(roomElement);
        
        // 렌더링 후 실제 위치 검증
        setTimeout(() => {
            const actualRect = roomElement.getBoundingClientRect();
            console.log('🔍 렌더링 후 실제 위치:', {
                roomName: room.roomName,
                expectedCSS: { left: finalLeft, top: finalTop },
                actualBounds: { 
                    left: actualRect.left, 
                    top: actualRect.top,
                    right: actualRect.right,
                    bottom: actualRect.bottom
                },
                computedStyle: {
                    left: roomElement.style.left,
                    top: roomElement.style.top,
                    position: window.getComputedStyle(roomElement).position
                }
            });
        }, 100);
    }
    
    selectElement(element) {
        this.clearSelection();
        this.selectedElement = element;
        element.classList.add('selected');
    }
    
    clearSelection() {
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
            this.selectedElement = null;
        }
    }
    
    editElement(element) {
        const type = element.dataset.type;
        const id = element.dataset.id;
        
        switch (type) {
            case 'building':
                this.editBuilding(element);
                break;
            case 'room':
                this.editRoom(element);
                break;
            case 'wireless-ap':
                this.editWirelessAP(element);
                break;
        }
    }
    
    editBuilding(element) {
        const name = prompt('건물명을 입력하세요:', element.textContent);
        if (name && name.trim()) {
            element.textContent = name.trim();
            this.showNotification('건물명이 변경되었습니다.');
        }
    }
    
    editRoom(element) {
        // 장비 배치 모드에서는 상세 모달 열기
        if (this.currentMode === 'device') {
            const roomData = {
                roomName: element.querySelector('.room-name')?.textContent || '교실',
                roomType: 'classroom',
                buildingName: '본관', // 실제로는 부모 건물에서 가져와야 함
                floorName: '1층' // 실제로는 부모 층에서 가져와야 함
            };
            
            // 커스텀 이벤트 발생
            const event = new CustomEvent('classroomClicked', {
                detail: {
                    classroomId: element.dataset.id,
                    roomData: roomData
                }
            });
            document.dispatchEvent(event);
        } else {
            // 평면도 설계 모드에서는 이름 편집
            const nameElement = element.querySelector('.room-name');
            const name = prompt('교실명을 입력하세요:', nameElement.textContent);
            if (name && name.trim()) {
                nameElement.textContent = name.trim();
                this.showNotification('교실명이 변경되었습니다.');
            }
        }
    }
    
    editWirelessAP(element) {
        const color = prompt('무선AP 색상 (예: #ff0000):', element.style.backgroundColor);
        if (color && color.trim()) {
            element.style.backgroundColor = color;
        }
    }
    
    handleMouseDown(e) {
        // 캔버스에서 빈 공간 클릭 시 선택 해제
        if (e.target.id === 'canvasContent') {
            this.clearSelection();
        }
    }
    
    // 터치 이벤트 (모바일 지원)
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.handleMouseDown(touch);
        }
    }
    
    handleTouchMove(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.handleMouseMove(touch);
        }
        e.preventDefault();
    }
    
    handleTouchEnd(e) {
        this.handleMouseUp(e);
    }
    
    async saveFloorPlan() {
        if (!this.currentSchoolId) {
            this.showNotification('학교를 먼저 선택해주세요.', 'error');
            return;
        }
        
        const saveData = this.collectFloorPlanData();
        
        try {
            const response = await fetch('/floorplan/api/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(saveData)
            });
            
            if (response.ok) {
                this.showNotification('평면도가 저장되었습니다.');
            } else {
                this.showNotification('저장에 실패했습니다.', 'error');
            }
        } catch (error) {
            console.error('저장 오류:', error);
            this.showNotification('저장 중 오류가 발생했습니다.', 'error');
        }
    }
    
    collectFloorPlanData() {
        const buildings = [];
        const rooms = [];
        
        // 건물 데이터 수집
        document.querySelectorAll('.building').forEach(element => {
            const building = {
                buildingId: element.dataset.id !== 'new' ? element.dataset.id : null,
                buildingName: element.textContent,
                xCoordinate: parseInt(element.style.left),
                yCoordinate: parseInt(element.style.top),
                width: parseInt(element.style.width),
                height: parseInt(element.style.height),
                schoolId: this.currentSchoolId
            };
            buildings.push(building);
        });
        
        // 교실 데이터 수집 (건물 안편 구분 없이)
        document.querySelectorAll('.room').forEach(element => {
            const roomNameElement = element.querySelector('.room-name');
            const room = {
                floorRoomId: element.dataset.id !== 'new' ? element.dataset.id : null,
                roomName: roomNameElement ? roomNameElement.textContent : '교실',
                roomType: 'classroom',
                xCoordinate: parseInt(element.style.left),
                yCoordinate: parseInt(element.style.top),
                width: parseInt(element.style.width),
                height: parseInt(element.style.height),
                schoolId: this.currentSchoolId,
                buildingId: element.dataset.buildingId || null // 건물에 속한 경우에만 값이 있음
            };
            rooms.push(room);
        });
        
        return {
            schoolId: this.currentSchoolId,
            buildings: buildings,
            rooms: rooms
        };
    }
    
    async downloadPPT() {
        if (!this.currentSchoolId) {
            this.showNotification('학교를 먼저 선택해주세요.', 'error');
            return;
        }
        
        try {
            this.showNotification('PPT 파일을 생성 중입니다...', 'success');
            
            const response = await fetch(`/floorplan/api/download-ppt/${this.currentSchoolId}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'school_floorplan.pptx';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                this.showNotification('PPT 파일이 다운로드되었습니다.');
            } else {
                this.showNotification('PPT 생성에 실패했습니다.', 'error');
            }
        } catch (error) {
            console.error('PPT 다운로드 오류:', error);
            this.showNotification('PPT 다운로드 중 오류가 발생했습니다.', 'error');
        }
    }
    
    updateCanvasForMode() {
        this.renderFloorPlan();
    }
    
    clearCanvas() {
        const canvas = document.getElementById('canvasContent');
        canvas.innerHTML = '';
    }
    
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notificationText');
        
        text.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    rgbToHex(rgb) {
        if (!rgb) return '#000000';
        
        const result = rgb.match(/\d+/g);
        if (!result) return '#000000';
        
        const [r, g, b] = result.map(Number);
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
    
    createWirelessAP(x, y) {
        if (!this.currentSchoolId) {
            this.showNotification('먼저 학교를 선택해주세요.', 'error');
            return;
        }
        
        // 클릭한 위치의 교실 찾기
        const roomElement = document.elementFromPoint(x, y)?.closest('.room');
        if (!roomElement) {
            this.showNotification('교실 위에 무선AP를 추가해주세요.', 'error');
            return;
        }
        
        const apData = {
            xCoordinate: x - roomElement.offsetLeft,
            yCoordinate: y - roomElement.offsetTop,
            radius: 8,
            color: '#ef4444'
        };
        
        this.renderWirelessAP(apData, roomElement.dataset.id);
        this.showNotification('무선AP가 추가되었습니다.');
    }

    // 도구 클릭 처리 - 도구 선택 방식으로 변경
    handleToolClick(tool) {
        switch (tool) {
            case 'building':
                this.selectTool('building'); // 즉시 생성 대신 도구 선택
                break;
            case 'room':
                this.selectTool('room'); // 즉시 생성 대신 도구 선택
                break;
            case 'select':
                this.selectTool('select');
                break;
            case 'delete':
                this.selectTool('delete');
                break;
            case 'copy':
                this.selectTool('copy');
                break;
            case 'add-ap':
                this.selectTool('add-ap');
                break;
            default:
                console.log('알 수 없는 도구:', tool);
        }
    }

}

// 미배치 교실 관리 클래스
class UnplacedRoomsManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.unplacedRooms = [];
        this.draggedRoom = null;
        this.isCollapsed = false; // 기본 상태를 펼쳐진 상태로 설정 (CSS와 일치)
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // 패널 토글 버튼
        document.getElementById('panelToggle').addEventListener('click', () => {
            this.togglePanel();
        });
        
        // 페이지 로드 시 패널을 닫힌 상태로 초기화
        const panel = document.getElementById('unplacedRoomsPanel');
        if (panel) {
            panel.classList.add('collapsed');
            this.isCollapsed = true;
            console.log('패널 초기화: 닫힌 상태로 설정됨');
        }
        
        // 캔버스 드롭 이벤트
        const canvas = document.getElementById('canvasContent');
        
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            canvas.classList.add('drag-over');
        });
        
        canvas.addEventListener('dragleave', (e) => {
            if (!canvas.contains(e.relatedTarget)) {
                canvas.classList.remove('drag-over');
            }
        });
        
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            canvas.classList.remove('drag-over');
            
            if (this.draggedRoom) {
                this.dropRoomOnCanvas(e);
            }
        });
    }
    
    togglePanel() {
        const panel = document.getElementById('unplacedRoomsPanel');
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            panel.classList.add('collapsed');
        } else {
            panel.classList.remove('collapsed');
        }
    }
    
    async loadUnplacedRooms(schoolId) {
        try {
            const response = await fetch(`/floorplan/api/unplaced-rooms/${schoolId}`);
            if (response.ok) {
                this.unplacedRooms = await response.json();
                this.renderUnplacedRooms();
            } else {
                console.error('미배치 교실 로딩 실패');
            }
        } catch (error) {
            console.error('미배치 교실 로딩 오류:', error);
            // 임시로 더미 데이터 사용
            this.loadDummyUnplacedRooms(schoolId);
        }
    }
    
    // 임시 더미 데이터 (실제 API가 없을 때)
    loadDummyUnplacedRooms(schoolId) {
        this.unplacedRooms = [
            { classroomId: 'temp1', roomName: '1-1교실', schoolId: schoolId },
            { classroomId: 'temp2', roomName: '1-2교실', schoolId: schoolId },
            { classroomId: 'temp3', roomName: '2-1교실', schoolId: schoolId },
            { classroomId: 'temp4', roomName: '2-2교실', schoolId: schoolId },
            { classroomId: 'temp5', roomName: '과학실', schoolId: schoolId },
            { classroomId: 'temp6', roomName: '음악실', schoolId: schoolId },
            { classroomId: 'temp7', roomName: '컴퓨터실', schoolId: schoolId }
        ];
        this.renderUnplacedRooms();
    }
    
    renderUnplacedRooms() {
        const container = document.getElementById('unplacedRoomsList');
        container.innerHTML = '';
        
        if (this.unplacedRooms.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">모든 교실이 배치되었습니다.</div>';
            return;
        }
        
        this.unplacedRooms.forEach(room => {
            const roomElement = this.createUnplacedRoomElement(room);
            container.appendChild(roomElement);
        });
    }
    
    createUnplacedRoomElement(room) {
        const element = document.createElement('div');
        element.className = 'unplaced-room-item';
        element.draggable = true;
        element.dataset.roomId = room.classroomId;
        
        element.innerHTML = `
            <div class="room-info">
                <div class="room-name">${room.roomName}</div>
                <div class="room-details">미배치 교실</div>
            </div>
            <div class="drag-icon">
                <i class="fas fa-grip-vertical"></i>
            </div>
        `;
        
        // 드래그 이벤트
        element.addEventListener('dragstart', (e) => {
            this.draggedRoom = room;
            element.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        
        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
            this.draggedRoom = null;
        });
        
        return element;
    }
    
    dropRoomOnCanvas(e) {
        if (!this.draggedRoom) return;
        
        // 드래그 앤 드롭 시점에 캔버스 정보를 실시간으로 다시 계산
        const canvas = document.getElementById('canvasContent');
        
        // 드롭 시점에 캔버스 정보를 새로 가져옴 (기존 요소들의 영향 반영)
        const rect = canvas.getBoundingClientRect();
        
        // 현재 캔버스의 스크롤 상태 확인
        const canvasScrollLeft = canvas.scrollLeft || 0;
        const canvasScrollTop = canvas.scrollTop || 0;
        
        // 마우스 위치에서 캔버스 경계 빼기
        let rawX = e.clientX - rect.left;
        let rawY = e.clientY - rect.top;
        
        // 기존 요소 개수만 확인 (보정은 제거)
        const existingRooms = document.querySelectorAll('.room').length;
        console.log('📊 현재 캔버스에 있는 교실 개수:', existingRooms);
        
        // 캔버스 스크롤 보정
        rawX += canvasScrollLeft;
        rawY += canvasScrollTop;
        
        // 줌 레벨 적용
        const adjustedX = rawX / this.floorPlanManager.zoomManager.zoomLevel;
        const adjustedY = rawY / this.floorPlanManager.zoomManager.zoomLevel;
        
        // 마우스 위치를 그대로 사용 (중심 위치 조정은 createRoomOnCanvasWithCoords에서 처리)
        const finalRoomX = adjustedX;
        const finalRoomY = adjustedY;
        
        console.log('=== 드래그 앤 드롭 디버깅 (실시간 개선) ===');
        console.log('원시 마우스 좌표:', { clientX: e.clientX, clientY: e.clientY });
        console.log('실시간 캔버스 경계:', { 
            left: rect.left, 
            top: rect.top, 
            width: rect.width, 
            height: rect.height 
        });
        console.log('캔버스 스크롤:', { left: canvasScrollLeft, top: canvasScrollTop });
        console.log('스크롤 보정 전 상대 좌표:', { x: e.clientX - rect.left, y: e.clientY - rect.top });
        console.log('스크롤 보정 후 좌표:', { rawX, rawY });
        console.log('줌 적용 좌표:', { adjustedX, adjustedY });
        console.log('최종 마우스 위치 (보정 전):', { roomX: finalRoomX, roomY: finalRoomY });
        console.log('줌 레벨:', this.floorPlanManager.zoomManager.zoomLevel);
        console.log('기존 요소 개수:', {
            buildings: document.querySelectorAll('.building').length,
            rooms: document.querySelectorAll('.room').length
        });
        console.log('📏 캔버스 실제 크기 및 상태:', {
            scrollSize: { width: canvas.scrollWidth, height: canvas.scrollHeight },
            clientSize: { width: canvas.clientWidth, height: canvas.clientHeight },
            offsetSize: { width: canvas.offsetWidth, height: canvas.offsetHeight },
            hasScrollbar: {
                horizontal: canvas.scrollWidth > canvas.clientWidth,
                vertical: canvas.scrollHeight > canvas.clientHeight
            },
            transform: canvas.style.transform || 'none'
        });
        
        // 좌표 유효성 검사
        if (finalRoomX < 0 || finalRoomY < 0) {
            console.warn('⚠️ 음수 좌표 감지! 최소값으로 조정합니다.', { finalRoomX, finalRoomY });
        }
        
        // 최소값 보정 (음수 방지)
        const correctedX = Math.max(0, finalRoomX);
        const correctedY = Math.max(0, finalRoomY);
        
        console.log('보정된 최종 좌표:', { correctedX, correctedY });
        
        // 실제 교실이 생성될 위치 계산 (마우스가 교실 중심이 되도록)
        const actualRoomX = correctedX - 50;
        const actualRoomY = correctedY - 40;
        
        // 마우스 위치에 파란색 마커 표시 (마우스 포인터 위치)
        const marker = document.createElement('div');
        marker.style.position = 'absolute';
        marker.style.left = (correctedX - 5) + 'px'; // 마우스 위치
        marker.style.top = (correctedY - 5) + 'px';
        marker.style.width = '10px';
        marker.style.height = '10px';
        marker.style.background = 'blue';
        marker.style.borderRadius = '50%';
        marker.style.zIndex = '9999';
        marker.style.pointerEvents = 'none';
        marker.className = 'debug-marker';
        marker.title = '마우스 위치';
        
        // 실제 교실이 생성될 위치에 빨간색 아웃라인 표시
        const roomOutline = document.createElement('div');
        roomOutline.style.position = 'absolute';
        roomOutline.style.left = actualRoomX + 'px';
        roomOutline.style.top = actualRoomY + 'px';
        roomOutline.style.width = '100px';
        roomOutline.style.height = '80px';
        roomOutline.style.border = '2px dashed red';
        roomOutline.style.background = 'rgba(255, 0, 0, 0.1)';
        roomOutline.style.zIndex = '9998';
        roomOutline.style.pointerEvents = 'none';
        roomOutline.className = 'debug-room-outline';
        roomOutline.title = '실제 교실 위치';
        
        console.log('🎯 디버그 마커 위치:', {
            마우스위치: { x: correctedX, y: correctedY },
            실제교실위치: { x: actualRoomX, y: actualRoomY }
        });
        
        canvas.appendChild(marker);
        canvas.appendChild(roomOutline);
        
        // 3초 후 마커들 제거
        setTimeout(() => {
            if (marker.parentNode) {
                marker.parentNode.removeChild(marker);
            }
            if (roomOutline.parentNode) {
                roomOutline.parentNode.removeChild(roomOutline);
            }
        }, 3000);
        
        // 최종 좌표 (오프셋 제거 - 완전 중첩 가능)
        const finalX = correctedX;
        const finalY = correctedY;
        
        console.log('🎯 최종 생성 좌표 (중첩 허용):', {
            x: finalX,
            y: finalY
        });
        
        // 교실을 캔버스에 생성 (보정된 좌표로 직접 전달)
        console.log('🏫 교실 생성 시도 중...');
        console.log('📄 메서드 존재 확인:', {
            'createRoomOnCanvasWithCoords exists': typeof this.createRoomOnCanvasWithCoords === 'function',
            'this.draggedRoom': this.draggedRoom,
            'finalX': finalX,
            'finalY': finalY
        });
        
        try {
            if (typeof this.createRoomOnCanvasWithCoords === 'function') {
                this.createRoomOnCanvasWithCoords(this.draggedRoom, finalX, finalY);
                console.log('✅ 교실 생성 성공! (중첩 허용)');
            } else {
                console.error('❌ createRoomOnCanvasWithCoords 메서드가 없습니다! 대체 메서드 사용...');
                // 기존 메서드 호출
                this.createRoomOnCanvas(this.draggedRoom, finalX + 50, finalY + 40);
            }
        } catch (error) {
            console.error('❌ 교실 생성 실패:', error);
            console.error('Error stack:', error.stack);
        }
        
        // 미배치 목록에서 제거
        this.removeFromUnplacedList(this.draggedRoom.classroomId);
        
        this.floorPlanManager.showNotification(`${this.draggedRoom.roomName}이(가) 평면도에 배치되었습니다.`);
    }
    
    createRoomOnCanvas(roomData, x, y) {
        const roomInfo = {
            classroomId: roomData.classroomId,
            roomName: roomData.roomName,
            roomType: 'classroom',
            xCoordinate: x - 50, // 마우스 위치가 교실 중심이 되도록 조정 (너비의 절반)
            yCoordinate: y - 40, // 마우스 위치가 교실 중심이 되도록 조정 (높이의 절반)
            width: 100,
            height: 80,
            schoolId: roomData.schoolId
        };
        
        // floorPlanData에 추가
        if (!this.floorPlanManager.floorPlanData.rooms) {
            this.floorPlanManager.floorPlanData.rooms = [];
        }
        this.floorPlanManager.floorPlanData.rooms.push(roomInfo);
        
        // 교실 렌더링
        this.floorPlanManager.renderRoom(roomInfo);
    }
    
    // 이미 계산된 좌표를 직접 사용하는 메서드
    createRoomOnCanvasWithCoords(roomData, x, y) {
        const roomInfo = {
            classroomId: roomData.classroomId,
            roomName: roomData.roomName,
            roomType: 'classroom',
            xCoordinate: x - 50, // 마우스 위치가 교실 중심이 되도록 조정 (너비의 절반)
            yCoordinate: y - 40, // 마우스 위치가 교실 중심이 되도록 조정 (높이의 절반)
            width: 100,
            height: 80,
            schoolId: roomData.schoolId
        };
        
        console.log('📍 실제 생성될 교실 정보:', roomInfo);
        console.log('📍 좌표 조정: 마우스({x: ' + x + ', y: ' + y + '}) → 교실({x: ' + roomInfo.xCoordinate + ', y: ' + roomInfo.yCoordinate + '})');
        
        // floorPlanData에 추가
        if (!this.floorPlanManager.floorPlanData.rooms) {
            this.floorPlanManager.floorPlanData.rooms = [];
        }
        this.floorPlanManager.floorPlanData.rooms.push(roomInfo);
        
        // 교실 렌더링
        this.floorPlanManager.renderRoom(roomInfo);
    }
    
    removeFromUnplacedList(roomId) {
        this.unplacedRooms = this.unplacedRooms.filter(room => room.classroomId !== roomId);
        this.renderUnplacedRooms();
    }
    
    // 교실이 평면도에서 제거될 때 미배치 목록에 다시 추가
    addToUnplacedList(roomData) {
        const unplacedRoom = {
            classroomId: roomData.classroomId || roomData.floorRoomId,
            roomName: roomData.roomName,
            schoolId: roomData.schoolId
        };
        
        // 이미 목록에 있는지 확인
        const exists = this.unplacedRooms.some(room => room.classroomId === unplacedRoom.classroomId);
        if (!exists) {
            this.unplacedRooms.push(unplacedRoom);
            this.renderUnplacedRooms();
        }
    }
}

// 애플리케이션 초기화
console.log('JavaScript 파일 로드됨 - DOMContentLoaded 이벤트 대기 중...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded 이벤트 발생!');
    console.log('FloorPlanManager 클래스:', FloorPlanManager);
    
    try {
        window.floorPlanManager = new FloorPlanManager();
        console.log('FloorPlanManager 인스턴스 생성 성공:', window.floorPlanManager);
        
        window.showNotification = window.floorPlanManager.showNotification.bind(window.floorPlanManager);
        console.log('전역 함수 바인딩 완료');
        
        // 수동 테스트 함수 추가
        window.testBuildingAdd = function() {
            console.log('수동 테스트 함수 실행');
            if (window.floorPlanManager) {
                window.floorPlanManager.currentTool = 'building';
                window.floorPlanManager.currentSchoolId = '1'; // 임시 학교 ID
                window.floorPlanManager.createBuilding(100, 100);
                console.log('테스트 건물 생성 시도 완료');
            } else {
                console.error('floorPlanManager가 없습니다!');
            }
        };
        
        console.log('초기화 완료 - 콘솔에서 testBuildingAdd() 실행해보세요');
        
    } catch (error) {
        console.error('FloorPlanManager 초기화 오류:', error);
    }
}); 