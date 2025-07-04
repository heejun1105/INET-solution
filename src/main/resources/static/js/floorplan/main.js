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
        
        // 크기 조절 완료 후 선택 상태 해제하여 빨간색 테두리 제거
        this.floorPlanManager.clearSelection();
        
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
        this.initialized = false;
        
        // DOM 요소가 준비된 후에 초기화하도록 지연
        if (this.canvas) {
            this.delayedInit();
        }
    }
    
    delayedInit() {
        // DOM 요소들이 존재하는지 확인 후 초기화
        const checkElements = () => {
            const zoomIn = document.getElementById('zoomIn');
            const zoomOut = document.getElementById('zoomOut');
            const zoomReset = document.getElementById('zoomReset');
            const zoomLevel = document.getElementById('zoomLevel');
            
            if (zoomIn && zoomOut && zoomReset && zoomLevel) {
                this.initEventListeners();
                this.updateZoomDisplay();
                this.initialized = true;
                console.log('✅ ZoomManager 초기화 완료');
            } else {
                // 요소들이 아직 준비되지 않았으면 100ms 후 다시 시도
                setTimeout(checkElements, 100);
            }
        };
        
        checkElements();
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
        if (!this.initialized) return;
        
        const percentage = Math.round(this.zoomLevel * 100);
        const zoomLevelElement = document.getElementById('zoomLevel');
        if (zoomLevelElement) {
            zoomLevelElement.textContent = `${percentage}%`;
        }
    }
    
    updateButtonStates() {
        if (!this.initialized) return;
        
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        
        if (!zoomInBtn || !zoomOutBtn) return;
        
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
        
        console.log('🎯 정밀한 좌표 계산:', {
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
        
        // FloorPlanManager의 안전한 좌표 계산 메서드 사용
        const canvasCoords = this.floorPlanManager.getCanvasCoordinates(e);
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
        
        // FloorPlanManager의 안전한 좌표 계산 메서드 사용
        const canvasCoords = this.floorPlanManager.getCanvasCoordinates(e);
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
            // 드래그 완료 후 스냅 피드백(파란색 테두리) 제거
            this.floorPlanManager.snapManager.hideSnapFeedback(this.dragElement);
            
            this.dragElement.style.zIndex = '';
            this.isDragging = false;
            // 드래그 완료 후 선택 상태는 유지 (clearSelection 제거)
        }
    }
}

// 박스 선택 관리 클래스
class SelectionBoxManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.isBoxSelecting = false;
        this.selectionBox = null;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.justCompletedSelection = false;
        this.MIN_DRAG_DISTANCE = 3; // 최소 드래그 거리를 3픽셀로 줄임 (더 쉽게 박스 선택 시작)
        this.hasActuallyDragged = false; // 실제 드래그 발생 여부
    }

    startBoxSelection(e) {
        console.log('🎯 startBoxSelection 호출됨:', { currentTool: this.floorPlanManager.currentTool });
        
        if (this.floorPlanManager.currentTool !== 'select') {
            console.log('❌ select 도구가 아님, 박스 선택 중단');
            return false;
        }
        
        const canvas = document.getElementById('canvasContent');
        const coords = this.floorPlanManager.getCanvasCoordinates(e);
        
        this.startX = coords.x;
        this.startY = coords.y;
        this.currentX = this.startX;
        this.currentY = this.startY;
        this.isBoxSelecting = true;
        this.hasActuallyDragged = false; // 드래그 상태 초기화
        
        console.log('📦 박스 선택 준비:', { startX: this.startX, startY: this.startY });
        
        // 선택 박스 요소는 실제 드래그가 발생했을 때 생성
        this.selectionBox = null;
        
        console.log('✅ 박스 선택 준비 완료');
        return true;
    }

    updateBoxSelection(e) {
        if (!this.isBoxSelecting) return;
        
        const coords = this.floorPlanManager.getCanvasCoordinates(e);
        this.currentX = coords.x;
        this.currentY = coords.y;
        
        // 시작점에서 현재 위치까지의 거리 계산
        const deltaX = Math.abs(this.currentX - this.startX);
        const deltaY = Math.abs(this.currentY - this.startY);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // 최소 드래그 거리 이상 움직였을 때만 실제 드래그로 인정
        if (!this.hasActuallyDragged && distance >= this.MIN_DRAG_DISTANCE) {
            this.hasActuallyDragged = true;
            this.createSelectionBox();
            console.log('📦 실제 드래그 시작! 박스 생성됨');
        }
        
        // 실제 드래그가 발생한 경우에만 박스 업데이트
        if (this.hasActuallyDragged && this.selectionBox) {
            const left = Math.min(this.startX, this.currentX);
            const top = Math.min(this.startY, this.currentY);
            const width = Math.abs(this.currentX - this.startX);
            const height = Math.abs(this.currentY - this.startY);
            
            this.selectionBox.style.left = left + 'px';
            this.selectionBox.style.top = top + 'px';
            this.selectionBox.style.width = width + 'px';
            this.selectionBox.style.height = height + 'px';
            
            // 큰 드래그만 로그 (너무 많은 로그 방지)
            if (width > 10 || height > 10) {
                console.log('📦 박스 업데이트:', { left, top, width, height });
            }
        }
    }
    
    createSelectionBox() {
        const canvas = document.getElementById('canvasContent');
        
        // 선택 박스 요소 생성
        this.selectionBox = document.createElement('div');
        this.selectionBox.className = 'selection-box';
        this.selectionBox.style.position = 'absolute';
        this.selectionBox.style.border = '4px dashed #3b82f6'; // 더 두꺼운 테두리
        this.selectionBox.style.background = 'rgba(59, 130, 246, 0.2)'; // 더 진한 배경
        this.selectionBox.style.pointerEvents = 'none';
        this.selectionBox.style.zIndex = '999999';
        this.selectionBox.style.left = this.startX + 'px';
        this.selectionBox.style.top = this.startY + 'px';
        this.selectionBox.style.width = '0px';
        this.selectionBox.style.height = '0px';
        this.selectionBox.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.8)'; // 더 강한 그림자
        this.selectionBox.style.animation = 'selectionPulse 0.8s ease-in-out infinite alternate'; // 펄스 애니메이션
        this.selectionBox.id = 'selection-box-debug';
        
        // 애니메이션 CSS 추가 (한 번만)
        if (!document.getElementById('selection-animation-style')) {
            const style = document.createElement('style');
            style.id = 'selection-animation-style';
            style.textContent = `
                @keyframes selectionPulse {
                    from { border-color: #3b82f6; box-shadow: 0 0 15px rgba(59, 130, 246, 0.8); }
                    to { border-color: #1d4ed8; box-shadow: 0 0 25px rgba(29, 78, 216, 1); }
                }
            `;
            document.head.appendChild(style);
        }
        
        canvas.appendChild(this.selectionBox);
        console.log('✅ 강화된 선택 박스 요소 생성 및 추가 완료');
    }

    endBoxSelection(e) {
        console.log('🏁 endBoxSelection 호출됨:', { 
            isBoxSelecting: this.isBoxSelecting, 
            hasActuallyDragged: this.hasActuallyDragged 
        });
        
        if (!this.isBoxSelecting) {
            console.log('❌ 박스 선택 중이 아님');
            return [];
        }
        
        // 실제 드래그가 발생하지 않았으면 선택 처리하지 않음
        if (!this.hasActuallyDragged) {
            console.log('📦 실제 드래그 없음 - 클릭으로 처리됨');
            this.isBoxSelecting = false;
            this.justCompletedSelection = false; // 클릭이므로 플래그 설정 안 함
            return [];
        }
        
        const left = Math.min(this.startX, this.currentX);
        const top = Math.min(this.startY, this.currentY);
        const right = Math.max(this.startX, this.currentX);
        const bottom = Math.max(this.startY, this.currentY);
        
        console.log('📦 박스 선택 영역:', { left, top, right, bottom });
        
        // 선택 박스 내의 요소들 찾기
        const elements = document.querySelectorAll('.building, .room');
        const selectedElements = [];
        
        console.log('🔍 검사할 요소 수:', elements.length);
        
        elements.forEach(element => {
            const rect = {
                left: parseInt(element.style.left) || 0,
                top: parseInt(element.style.top) || 0,
                right: (parseInt(element.style.left) || 0) + (parseInt(element.style.width) || 100),
                bottom: (parseInt(element.style.top) || 0) + (parseInt(element.style.height) || 80)
            };
            
            // 요소가 선택 박스와 겹치는지 확인
            if (rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top) {
                selectedElements.push(element);
                console.log('✅ 선택된 요소:', element.dataset.type, element.textContent?.trim());
            }
        });
        
        console.log('📦 총 선택된 요소 수:', selectedElements.length);
        
        // 선택 박스 제거
        if (this.selectionBox && this.selectionBox.parentNode) {
            this.selectionBox.parentNode.removeChild(this.selectionBox);
            console.log('🗑️ 선택 박스 제거됨');
        }
        this.selectionBox = null;
        this.isBoxSelecting = false;
        
        this.justCompletedSelection = true;
        
        return selectedElements;
    }

    cancelBoxSelection() {
        if (this.selectionBox && this.selectionBox.parentNode) {
            this.selectionBox.parentNode.removeChild(this.selectionBox);
        }
        this.selectionBox = null;
        this.isBoxSelecting = false;
    }
}

// 다중 선택 관리 클래스
class MultiSelectManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.selectedElements = [];
    }

    selectElement(element, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }
        
        if (!this.selectedElements.includes(element)) {
            this.selectedElements.push(element);
            element.classList.add('multi-selected');
        }
        
        this.updateSelectionDisplay();
    }

    selectElements(elements, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }
        
        elements.forEach(element => {
            if (!this.selectedElements.includes(element)) {
                this.selectedElements.push(element);
                element.classList.add('multi-selected');
            }
        });
        
        this.updateSelectionDisplay();
    }

    deselectElement(element) {
        const index = this.selectedElements.indexOf(element);
        if (index > -1) {
            this.selectedElements.splice(index, 1);
            element.classList.remove('multi-selected');
        }
        
        this.updateSelectionDisplay();
    }

    toggleElement(element) {
        if (this.selectedElements.includes(element)) {
            this.deselectElement(element);
        } else {
            this.selectElement(element, true);
        }
    }

    clearSelection() {
        // 모든 다중 선택된 요소들의 스타일 제거
        this.selectedElements.forEach(element => {
            element.classList.remove('multi-selected');
        });
        
        // 선택된 요소 배열 초기화
        this.selectedElements = [];
        
        // 선택 상태 표시 업데이트
        this.updateSelectionDisplay();
    }

    updateSelectionDisplay() {
        const count = this.selectedElements.length;
        const infoElement = document.getElementById('multiSelectInfo');
        const textElement = document.getElementById('multiSelectText');
        
        // DOM 요소들이 존재하는지 확인
        if (!infoElement || !textElement) {
            console.warn('다중 선택 표시 요소들을 찾을 수 없습니다.');
            return;
        }
        
        if (count > 1) {
            textElement.textContent = `${count}개 요소 선택됨 - Ctrl+드래그로 그룹 이동`;
            infoElement.classList.add('show');
        } else {
            infoElement.classList.remove('show');
        }
    }

    getSelectedElements() {
        return [...this.selectedElements];
    }

    hasSelection() {
        return this.selectedElements.length > 0;
    }

    getSelectionBounds() {
        if (this.selectedElements.length === 0) return null;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        this.selectedElements.forEach(element => {
            const left = parseInt(element.style.left) || 0;
            const top = parseInt(element.style.top) || 0;
            const right = left + (parseInt(element.style.width) || 100);
            const bottom = top + (parseInt(element.style.height) || 80);
            
            minX = Math.min(minX, left);
            minY = Math.min(minY, top);
            maxX = Math.max(maxX, right);
            maxY = Math.max(maxY, bottom);
        });
        
        return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }
}

// 그룹 드래그 관리 클래스
class GroupDragManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.isDragging = false;
        this.dragElements = [];
        this.startPositions = [];
        this.startX = 0;
        this.startY = 0;
    }

    startGroupDrag(elements, e) {
        if (elements.length === 0) return false;
        
        this.dragElements = [...elements];
        this.startPositions = elements.map(element => ({
            element: element,
            x: parseInt(element.style.left) || 0,
            y: parseInt(element.style.top) || 0
        }));
        
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.isDragging = true;
        
        // 드래그 중 시각적 효과
        this.dragElements.forEach(element => {
            element.style.zIndex = '1000';
            element.style.opacity = '0.8';
            element.style.pointerEvents = 'none'; // 마우스 이벤트 비활성화
        });
        
        // 캔버스 커서 변경
        document.getElementById('canvasContent').style.cursor = 'move';
        
        return true;
    }

    updateGroupDrag(e) {
        if (!this.isDragging) return;
        
        const deltaX = e.clientX - this.startX;
        const deltaY = e.clientY - this.startY;
        
        // 줌 레벨 적용 (zoomManager가 있고 초기화되었을 때만)
        let zoomLevel = 1.0;
        if (this.floorPlanManager.zoomManager && this.floorPlanManager.zoomManager.initialized) {
            zoomLevel = this.floorPlanManager.zoomManager.getCurrentZoom();
        }
        const adjustedDeltaX = deltaX / zoomLevel;
        const adjustedDeltaY = deltaY / zoomLevel;
        
        this.startPositions.forEach(({ element, x, y }) => {
            const newX = x + adjustedDeltaX;
            const newY = y + adjustedDeltaY;
            
            // 스냅 적용 (첫 번째 요소 기준)
            if (element === this.dragElements[0]) {
                const snappedPosition = this.floorPlanManager.snapManager.snapElement(element, newX, newY);
                const snapDeltaX = snappedPosition.x - newX;
                const snapDeltaY = snappedPosition.y - newY;
                
                // 모든 요소에 스냅 오프셋 적용
                this.startPositions.forEach(({ element: el, x: origX, y: origY }) => {
                    el.style.left = Math.max(0, origX + adjustedDeltaX + snapDeltaX) + 'px';
                    el.style.top = Math.max(0, origY + adjustedDeltaY + snapDeltaY) + 'px';
                });
            }
        });
    }

    endGroupDrag() {
        if (!this.isDragging) return;
        
        // 드래그 효과 제거
        this.dragElements.forEach(element => {
            element.style.zIndex = '';
            element.style.opacity = '';
            element.style.pointerEvents = ''; // 마우스 이벤트 다시 활성화
            this.floorPlanManager.snapManager.hideSnapFeedback(element);
        });
        
        // 캔버스 커서 원래대로
        this.floorPlanManager.updateCanvasCursor();
        
        this.isDragging = false;
        this.dragElements = [];
        this.startPositions = [];
        
        this.floorPlanManager.showNotification('그룹 이동이 완료되었습니다.');
    }

    cancelGroupDrag() {
        if (!this.isDragging) return;
        
        // 원래 위치로 복원
        this.startPositions.forEach(({ element, x, y }) => {
            element.style.left = x + 'px';
            element.style.top = y + 'px';
            element.style.zIndex = '';
            element.style.opacity = '';
            element.style.pointerEvents = ''; // 마우스 이벤트 다시 활성화
        });
        
        // 캔버스 커서 원래대로
        this.floorPlanManager.updateCanvasCursor();
        
        this.isDragging = false;
        this.dragElements = [];
        this.startPositions = [];
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
        
        // 캔버스 요소가 존재하는지 확인 후 ZoomManager 초기화
        const canvasElement = document.getElementById('canvasContent');
        if (canvasElement) {
            this.zoomManager = new ZoomManager(canvasElement); // 확대/축소 관리자 추가
        } else {
            console.warn('⚠️ canvasContent 요소를 찾을 수 없습니다. ZoomManager 초기화를 건너뜁니다.');
            this.zoomManager = null;
        }
        
        this.dragManager = new DragManager(this); // DragManager 인스턴스 추가
        this.unplacedRoomsManager = new UnplacedRoomsManager(this); // 미배치 교실 관리자 추가
        this.selectionBoxManager = new SelectionBoxManager(this); // 박스 선택 관리자 추가
        this.multiSelectManager = new MultiSelectManager(this); // 다중 선택 관리자 추가
        this.groupDragManager = new GroupDragManager(this); // 그룹 드래그 관리자 추가
        
        this.init();
    }
    
    init() {
        console.log('🚀 FloorPlanManager 초기화 시작');
        this.bindEvents();
        this.setupCanvas();
        
        // 기본 모드를 먼저 설정 (layout 모드)
        this.switchMode('layout');
        
        // 기본적으로 select 도구 선택
        this.selectTool('select');
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
        const downloadButtonElement = document.getElementById('downloadButton');
        if (downloadButtonElement) {
            downloadButtonElement.addEventListener('click', () => {
                this.downloadPPT();
            });
        }
        
        // 캔버스 이벤트
        this.setupCanvasEvents();
    }
    
    setupCanvas() {
        const canvas = document.getElementById('canvasContent');
        
        if (!canvas) {
            console.error('캔버스 요소를 찾을 수 없습니다!');
            return;
        }
        
        // click 이벤트 제거 - setupCanvasEvents에서 통합 처리
        canvas.addEventListener('contextmenu', (e) => this.handleRightClick(e));
    }
    
    setupCanvasEvents() {
        // 전역 마우스 이벤트 (드래그용)
        document.addEventListener('mousemove', (e) => {
            this.dragManager.handleMouseMove(e);
            this.resizeManager.handleMouseMove(e);
            this.selectionBoxManager.updateBoxSelection(e);
            this.groupDragManager.updateGroupDrag(e);
        });
        
        document.addEventListener('mouseup', (e) => {
            this.dragManager.handleMouseUp(e);
            this.resizeManager.handleMouseUp(e);
            
            // 박스 선택 완료 처리
            let boxSelectionOccurred = false;
            if (this.selectionBoxManager.isBoxSelecting) {
                const selectedElements = this.selectionBoxManager.endBoxSelection(e);
                if (selectedElements.length > 0) {
                    const addToSelection = e.ctrlKey || e.metaKey;
                    this.multiSelectManager.selectElements(selectedElements, addToSelection);
                    boxSelectionOccurred = true;
                }
            }
            
            // 그룹 드래그 완료 처리
            if (this.groupDragManager.isDragging) {
                this.groupDragManager.endGroupDrag();
            }
            
            // 박스 선택이나 드래그가 발생하지 않았고, 캔버스 클릭 좌표가 있으면 클릭 처리
            if (!boxSelectionOccurred && !this.dragManager.isDragging && 
                !this.groupDragManager.isDragging && this.pendingClickCoords && 
                e.target.id === 'canvasContent') {
                this.handleCanvasClickAtCoords(this.pendingClickCoords);
            }
            
            // 대기 중인 클릭 좌표 초기화
            this.pendingClickCoords = null;
        });
        
        // 터치 이벤트 (모바일 지원)
        const canvas = document.getElementById('canvasContent');
        canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // 캔버스 마우스 다운 이벤트 (박스 선택과 그룹 드래그용)
        canvas.addEventListener('mousedown', (e) => {
            this.handleCanvasMouseDown(e);
        });
        
        // ESC 키로 선택 해제
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.multiSelectManager.clearSelection();
                this.clearSelection();
                this.selectionBoxManager.cancelBoxSelection();
                this.groupDragManager.cancelGroupDrag();
            }
        });
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
        
        // 도구 전환 시 선택 해제
        this.clearSelection();
        
        // 현재 활성화된 toolbar 찾기
        const activeToolbar = document.querySelector('.toolbar.active');
        if (!activeToolbar) {
            console.warn('활성화된 toolbar를 찾을 수 없습니다. 기본 모드가 설정되지 않았을 수 있습니다.');
            
            // 기본 모드가 설정되지 않았다면 layout 모드로 설정
            if (!this.currentMode) {
                console.log('기본 모드가 없어서 layout 모드로 설정합니다.');
                this.switchMode('layout');
                // 다시 시도
                const retryToolbar = document.querySelector('.toolbar.active');
                if (retryToolbar) {
                    this.updateToolButtons(retryToolbar, tool);
                }
            }
        } else {
            this.updateToolButtons(activeToolbar, tool);
        }
        
        // 캔버스 커서 업데이트
        this.updateCanvasCursor();
        
        // select 도구일 때 박스 선택 활성화
        if (tool === 'select') {
            this.selectionBoxManager.isEnabled = true;
        } else {
            this.selectionBoxManager.isEnabled = false;
            this.selectionBoxManager.cancelBoxSelection();
        }
    }
    
    updateToolButtons(toolbar, tool) {
        // 해당 toolbar 내의 모든 버튼 비활성화
        toolbar.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 해당 toolbar 내의 해당 도구 버튼 활성화
        const activeButton = toolbar.querySelector(`[data-tool="${tool}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
            console.log(`✅ "${tool}" 도구 버튼이 활성화되었습니다.`);
        } else {
            console.warn(`도구 "${tool}"에 해당하는 버튼을 찾을 수 없습니다!`);
        }
    }
    
    updateCanvasCursor() {
        const canvas = document.getElementById('canvasContent');
        
        // CSS의 고정 커서를 덮어쓰기 위해 !important 스타일 적용
        switch (this.currentTool) {
            case 'select':
                canvas.style.setProperty('cursor', 'default', 'important');
                console.log('🖱️ 커서를 default로 변경 (select 도구)');
                break;
            case 'building':
                canvas.style.setProperty('cursor', 'crosshair', 'important');
                break;
            case 'room':
                canvas.style.setProperty('cursor', 'crosshair', 'important');
                break;
            case 'add-ap':
                canvas.style.setProperty('cursor', 'crosshair', 'important');
                break;
            case 'delete':
                canvas.style.setProperty('cursor', 'not-allowed', 'important');
                break;
            case 'copy':
                canvas.style.setProperty('cursor', 'copy', 'important');
                break;
            default:
                canvas.style.setProperty('cursor', 'default', 'important');
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
        
        buildingElement.style.position = 'absolute'; // 절대 위치 명시적 설정
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
            
            if (this.currentTool === 'select') {
                const isCtrlClick = e.ctrlKey || e.metaKey;
                
                if (isCtrlClick) {
                    // Ctrl+클릭으로 다중 선택 토글
                    this.multiSelectManager.toggleElement(element);
                } else {
                    // 단일 선택 (기존 다중 선택 해제)
                    this.multiSelectManager.clearSelection();
                    this.selectElement(element);
                }
            } else if (this.currentTool === 'delete') {
                element.remove();
                this.showNotification('요소가 삭제되었습니다.');
            } else {
                this.editElement(element);
            }
        });
        
        element.addEventListener('mousedown', (e) => {
            if (this.currentTool === 'select') {
                e.stopPropagation();
                
                // 크기 조절 핸들 클릭이 아닌 경우에만 드래그 시작
                if (e.target.classList.contains('resize-handle')) {
                    return; // 크기 조절 핸들은 ResizeManager가 처리
                }
                
                // 다중 선택된 요소들 중 하나를 클릭한 경우 그룹 드래그 시작
                if (this.multiSelectManager.hasSelection() && 
                    this.multiSelectManager.getSelectedElements().includes(element)) {
                    this.groupDragManager.startGroupDrag(this.multiSelectManager.getSelectedElements(), e);
                } else {
                    // 단일 요소 드래그 - Ctrl 키가 없으면 다중 선택만 해제
                    if (!e.ctrlKey && !e.metaKey && this.multiSelectManager.hasSelection()) {
                        this.multiSelectManager.clearSelection();
                    }
                    this.dragManager.startDrag(element, e);
                }
            }
        });
        
        // mouseup 이벤트 추가 - 그룹 드래그 종료 처리
        element.addEventListener('mouseup', (e) => {
            // 그룹 드래그가 진행 중이면 종료 처리
            if (this.groupDragManager.isDragging) {
                e.stopPropagation();
                this.groupDragManager.endGroupDrag();
            }
        });
        
        // 크기 조절 핸들 추가
        this.resizeManager.addResizeHandles(element);
    }
    
    handleCanvasMouseDown(e) {
        // 빈 캔버스 공간에서 마우스 다운 시 처리
        if (e.target.id === 'canvasContent') {
            if (this.currentTool === 'select') {
                // Ctrl 키 없이 클릭하면 기존 선택 해제
                if (!e.ctrlKey && !e.metaKey) {
                    this.multiSelectManager.clearSelection();
                    this.clearSelection();
                }
                
                // 박스 선택 시작 시도
                const started = this.selectionBoxManager.startBoxSelection(e);
                
                // 박스 선택이 시작되지 않았다면 클릭 위치 저장 (클릭 처리용)
                if (!started) {
                    this.pendingClickCoords = this.getCanvasCoordinates(e);
                }
            } else {
                // select 도구가 아닌 경우 클릭 위치 저장
                this.pendingClickCoords = this.getCanvasCoordinates(e);
            }
        }
    }
    
    handleCanvasClick(e) {
        // 요소 클릭이 아닌 캔버스 배경 클릭만 처리
        if (e.target.id !== 'canvasContent') {
            return;
        }
        
        // 박스 선택이 막 완료된 경우에는 클릭 처리를 건너뜀
        if (this.selectionBoxManager.justCompletedSelection) {
            this.selectionBoxManager.justCompletedSelection = false;
            return;
        }
        
        // 새로운 정확한 좌표 계산 메서드 사용
        const coords = this.getCanvasCoordinates(e);
        const x = coords.x;
        const y = coords.y;
        
        console.log('=== 캔버스 클릭 디버깅 ===');
        console.log('마우스 이벤트:', { clientX: e.clientX, clientY: e.clientY });
        console.log('계산된 캔버스 좌표:', { x, y });
        console.log('기존 요소 개수:', {
            buildings: document.querySelectorAll('.building').length,
            rooms: document.querySelectorAll('.room').length
        });
        
        // 클릭 위치에 임시 마커 표시 (디버깅용) - 절대 위치
        const marker = document.createElement('div');
        marker.style.position = 'fixed';
        marker.style.left = (e.clientX - 5) + 'px'; // 마우스 절대 위치
        marker.style.top = (e.clientY - 5) + 'px';
        marker.style.width = '10px';
        marker.style.height = '10px';
        marker.style.background = 'red';
        marker.style.borderRadius = '50%';
        marker.style.zIndex = '9999';
        marker.style.pointerEvents = 'none';
        marker.className = 'debug-marker';
        marker.title = '클릭 위치 (절대)';
        
        document.body.appendChild(marker);
        
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
                // 선택 해제 (단일 선택과 다중 선택 모두 해제)
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
        
        roomElement.style.position = 'absolute'; // 절대 위치 명시적 설정
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
        // 기존 단일 선택 해제
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
            // 스냅 피드백(파란색 테두리)도 함께 제거
            this.snapManager.hideSnapFeedback(this.selectedElement);
            this.selectedElement = null;
        }
        
        // 다중 선택도 해제
        this.multiSelectManager.clearSelection();
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

    getCanvasCoordinates(e) {
        // zoomManager가 있으면 그것을 사용하고, 없으면 기본 계산 수행
        if (this.zoomManager && this.zoomManager.initialized) {
            return this.zoomManager.getCanvasCoordinates(e);
        } else {
            // 기본 좌표 계산 (줌이 적용되지 않은 상태)
            const canvas = document.getElementById('canvasContent');
            if (!canvas) {
                console.warn('캔버스 요소를 찾을 수 없습니다.');
                return { x: 0, y: 0 };
            }
            
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            console.log('🎯 기본 좌표 계산:', {
                mouse: { clientX: e.clientX, clientY: e.clientY },
                canvasBounds: { left: rect.left, top: rect.top },
                result: { x, y }
            });
            
            return { x, y };
        }
    }

    handleCanvasClickAtCoords(coords) {
        console.log('🎯 handleCanvasClickAtCoords 호출됨:', { coords, currentTool: this.currentTool });
        
        const x = coords.x;
        const y = coords.y;
        
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
                // 선택 해제 (단일 선택과 다중 선택 모두 해제) - 박스 선택이 아닌 경우에만
                console.log('🧹 클릭으로 인한 선택 해제');
                this.clearSelection();
                break;
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
        
        console.log('=== 드래그 앤 드롭 디버깅 (마진 제거) ===');
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
        console.log('최종 마우스 위치:', { roomX: finalRoomX, roomY: finalRoomY });
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
        
        // 마우스 위치에 파란색 마커 표시 (절대 위치) 
        const marker = document.createElement('div');
        marker.style.position = 'fixed';
        marker.style.left = (e.clientX - 5) + 'px'; // 마우스 절대 위치
        marker.style.top = (e.clientY - 5) + 'px';
        marker.style.width = '10px';
        marker.style.height = '10px';
        marker.style.background = 'blue';
        marker.style.borderRadius = '50%';
        marker.style.zIndex = '9999';
        marker.style.pointerEvents = 'none';
        marker.className = 'debug-marker';
        marker.title = '마우스 위치 (절대)';
        
        // 실제 교실이 생성될 위치에 빨간색 아웃라인 표시 (캔버스 내부)
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
            마우스절대위치: { x: e.clientX, y: e.clientY },
            마우스캔버스위치: { x: correctedX, y: correctedY },
            실제교실위치: { x: actualRoomX, y: actualRoomY }
        });
        
        document.body.appendChild(marker); // 절대 위치 마커는 body에 추가
        canvas.appendChild(roomOutline); // 교실 아웃라인은 캔버스에 추가
        
        // 0.5초 후 마커들 제거
        setTimeout(() => {
            if (marker.parentNode) {
                marker.parentNode.removeChild(marker);
            }
            if (roomOutline.parentNode) {
                roomOutline.parentNode.removeChild(roomOutline);
            }
        }, 500);
        
        // 최종 좌표
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