/**
 * InteractionManager.js
 * 모든 사용자 입력을 통합 관리
 * 
 * 책임:
 * - 드래그 (단일/다중/그룹)
 * - 줌 (마우스 휠/제스처)
 * - 팬 (스페이스바+드래그, 마우스 휠 드래그)
 * - 선택 (클릭/박스)
 * - 리사이즈
 * - 이벤트 충돌 방지
 */

export default class InteractionManager {
    /**
     * @param {FloorPlanCore} core - FloorPlanCore 인스턴스
     */
    constructor(core) {
        if (!core) {
            throw new Error('FloorPlanCore instance is required');
        }
        
        console.log('🎮 InteractionManager 초기화 시작');
        
        this.core = core;
        this.canvas = core.canvas;
        
        // 상태 플래그 (이벤트 충돌 방지)
        this.state = {
            isDragging: false,
            isPanning: false,
            isSelecting: false,
            isResizing: false,
            isSpacePressed: false
        };
        
        // 드래그 시작 정보
        this.dragStart = {
            x: 0,
            y: 0,
            elements: [],
            originalPositions: new Map()
        };
        
        // 팬 시작 정보
        this.panStart = {
            x: 0,
            y: 0,
            panX: 0,
            panY: 0
        };
        
        // 선택 박스 정보
        this.selectionBox = {
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0
        };
        
        // 이벤트 리스너 참조 (정리용)
        this.handlers = {};
        
        this.init();
    }
    
    /**
     * 초기화
     */
    init() {
        this.setupEventListeners();
        console.log('✅ InteractionManager 초기화 완료');
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 마우스 이벤트
        this.handlers.mousedown = this.onMouseDown.bind(this);
        this.handlers.mousemove = this.onMouseMove.bind(this);
        this.handlers.mouseup = this.onMouseUp.bind(this);
        this.handlers.wheel = this.onWheel.bind(this);
        this.handlers.contextmenu = this.onContextMenu.bind(this);
        
        // 키보드 이벤트
        this.handlers.keydown = this.onKeyDown.bind(this);
        this.handlers.keyup = this.onKeyUp.bind(this);
        
        // 리스너 등록
        this.canvas.addEventListener('mousedown', this.handlers.mousedown);
        this.canvas.addEventListener('mousemove', this.handlers.mousemove);
        this.canvas.addEventListener('mouseup', this.handlers.mouseup);
        this.canvas.addEventListener('wheel', this.handlers.wheel, { passive: false });
        this.canvas.addEventListener('contextmenu', this.handlers.contextmenu);
        
        window.addEventListener('keydown', this.handlers.keydown);
        window.addEventListener('keyup', this.handlers.keyup);
        
        // 마우스가 캔버스 밖으로 나갔을 때도 처리
        document.addEventListener('mouseup', this.handlers.mouseup);
        document.addEventListener('mousemove', this.handlers.mousemove);
        
        console.log('👂 InteractionManager 이벤트 리스너 등록 완료');
    }
    
    // ===== 마우스 이벤트 핸들러 =====
    
    /**
     * 마우스 다운
     */
    onMouseDown(e) {
        e.preventDefault();
        
        const { x, y } = this.getMousePos(e);
        const canvasPos = this.core.screenToCanvas(x, y);
        
        console.debug('🖱️ 마우스 다운:', canvasPos);
        
        // 스페이스바가 눌려있으면 팬 모드
        if (this.state.isSpacePressed || e.button === 1) { // 중간 버튼도 팬
            this.startPan(x, y);
            return;
        }
        
        // 우클릭은 컨텍스트 메뉴
        if (e.button === 2) {
            this.showContextMenu(canvasPos.x, canvasPos.y);
            return;
        }
        
        // 요소 위에서 클릭했는지 확인
        const clickedElement = this.findElementAt(canvasPos.x, canvasPos.y);
        
        if (clickedElement) {
            // 요소 클릭
            if (e.shiftKey) {
                // Shift + 클릭: 다중 선택 토글
                this.toggleSelection(clickedElement);
            } else if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd + 클릭: 다중 선택 추가
                this.addToSelection(clickedElement);
            } else {
                // 일반 클릭: 단일 선택
                if (!this.isSelected(clickedElement)) {
                    this.selectElement(clickedElement);
                }
            }
            
            // 드래그 시작
            this.startDrag(x, y);
        } else {
            // 빈 공간 클릭: 선택 박스 시작
            this.startSelectionBox(x, y);
        }
    }
    
    /**
     * 마우스 이동
     */
    onMouseMove(e) {
        const { x, y } = this.getMousePos(e);
        const canvasPos = this.core.screenToCanvas(x, y);
        
        // 팬 중
        if (this.state.isPanning) {
            this.updatePan(x, y);
            return;
        }
        
        // 드래그 중
        if (this.state.isDragging) {
            this.updateDrag(x, y);
            return;
        }
        
        // 선택 박스 중
        if (this.state.isSelecting) {
            this.updateSelectionBox(x, y);
            return;
        }
        
        // 호버 처리
        this.updateHover(canvasPos.x, canvasPos.y);
    }
    
    /**
     * 마우스 업
     */
    onMouseUp(e) {
        console.debug('🖱️ 마우스 업');
        
        // 팬 종료
        if (this.state.isPanning) {
            this.endPan();
        }
        
        // 드래그 종료
        if (this.state.isDragging) {
            this.endDrag();
        }
        
        // 선택 박스 종료
        if (this.state.isSelecting) {
            this.endSelectionBox();
        }
    }
    
    /**
     * 마우스 휠
     */
    onWheel(e) {
        e.preventDefault();
        
        const { x, y } = this.getMousePos(e);
        const delta = -e.deltaY;
        
        // 줌 레벨 계산
        const zoomFactor = delta > 0 ? 1.1 : 0.9;
        const newZoom = this.core.state.zoom * zoomFactor;
        
        // 마우스 위치를 중심으로 줌
        this.core.setZoom(newZoom, x, y);
        
        console.debug('🔍 줌:', newZoom.toFixed(2));
    }
    
    /**
     * 컨텍스트 메뉴
     */
    onContextMenu(e) {
        e.preventDefault();
    }
    
    // ===== 키보드 이벤트 핸들러 =====
    
    /**
     * 키 다운
     */
    onKeyDown(e) {
        // 스페이스바: 팬 모드
        if (e.code === 'Space' && !this.state.isSpacePressed) {
            e.preventDefault();
            this.state.isSpacePressed = true;
            this.canvas.style.cursor = 'grab';
        }
        
        // Delete/Backspace: 선택 요소 삭제
        if ((e.code === 'Delete' || e.code === 'Backspace') && 
            this.core.state.selectedElements.length > 0) {
            e.preventDefault();
            this.deleteSelected();
        }
        
        // Ctrl/Cmd + A: 전체 선택
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
            e.preventDefault();
            this.selectAll();
        }
        
        // Escape: 선택 해제
        if (e.code === 'Escape') {
            this.clearSelection();
        }
    }
    
    /**
     * 키 업
     */
    onKeyUp(e) {
        // 스페이스바 해제
        if (e.code === 'Space') {
            this.state.isSpacePressed = false;
            this.canvas.style.cursor = 'default';
        }
    }
    
    // ===== 드래그 =====
    
    /**
     * 드래그 시작
     */
    startDrag(x, y) {
        this.state.isDragging = true;
        
        this.dragStart.x = x;
        this.dragStart.y = y;
        this.dragStart.elements = [...this.core.state.selectedElements];
        
        // 원래 위치 저장
        this.dragStart.originalPositions.clear();
        for (const element of this.dragStart.elements) {
            this.dragStart.originalPositions.set(element.id, {
                x: element.xCoordinate,
                y: element.yCoordinate
            });
        }
        
        this.canvas.style.cursor = 'move';
        
        console.debug('🚀 드래그 시작:', this.dragStart.elements.length, '개 요소');
    }
    
    /**
     * 드래그 업데이트
     */
    updateDrag(x, y) {
        const dx_screen = x - this.dragStart.x;
        const dy_screen = y - this.dragStart.y;
        
        // 화면 좌표 이동을 캔버스 좌표 이동으로 변환
        const dx_canvas = dx_screen / this.core.state.zoom;
        const dy_canvas = dy_screen / this.core.state.zoom;
        
        // 모든 선택 요소 이동
        for (const element of this.dragStart.elements) {
            const originalPos = this.dragStart.originalPositions.get(element.id);
            if (originalPos) {
                let newX = originalPos.x + dx_canvas;
                let newY = originalPos.y + dy_canvas;
                
                // 그리드 스냅 적용
                if (this.core.state.snapToGrid) {
                    const snapped = this.core.snapToGrid(newX, newY);
                    newX = snapped.x;
                    newY = snapped.y;
                }
                
                // 요소 업데이트
                this.core.updateElement(element.id, {
                    xCoordinate: newX,
                    yCoordinate: newY
                });
            }
        }
    }
    
    /**
     * 드래그 종료
     */
    endDrag() {
        console.debug('✅ 드래그 종료');
        
        this.state.isDragging = false;
        this.canvas.style.cursor = 'default';
        
        // 드래그 정보 초기화
        this.dragStart.elements = [];
        this.dragStart.originalPositions.clear();
    }
    
    // ===== 팬 =====
    
    /**
     * 팬 시작
     */
    startPan(x, y) {
        this.state.isPanning = true;
        
        this.panStart.x = x;
        this.panStart.y = y;
        this.panStart.panX = this.core.state.panX;
        this.panStart.panY = this.core.state.panY;
        
        this.canvas.style.cursor = 'grabbing';
        
        console.debug('🤚 팬 시작');
    }
    
    /**
     * 팬 업데이트
     */
    updatePan(x, y) {
        const dx = x - this.panStart.x;
        const dy = y - this.panStart.y;
        
        const newPanX = this.panStart.panX + dx;
        const newPanY = this.panStart.panY + dy;
        
        this.core.setPan(newPanX, newPanY);
    }
    
    /**
     * 팬 종료
     */
    endPan() {
        console.debug('✅ 팬 종료');
        
        this.state.isPanning = false;
        this.canvas.style.cursor = this.state.isSpacePressed ? 'grab' : 'default';
    }
    
    // ===== 선택 박스 =====
    
    /**
     * 선택 박스 시작
     */
    startSelectionBox(x, y) {
        this.state.isSelecting = true;
        
        this.selectionBox.startX = x;
        this.selectionBox.startY = y;
        this.selectionBox.endX = x;
        this.selectionBox.endY = y;
        
        // 기존 선택 해제 (Shift 키가 안 눌려있으면)
        if (!window.event.shiftKey) {
            this.clearSelection();
        }
        
        console.debug('📦 선택 박스 시작');
    }
    
    /**
     * 선택 박스 업데이트
     */
    updateSelectionBox(x, y) {
        this.selectionBox.endX = x;
        this.selectionBox.endY = y;
        
        // 선택 박스 렌더링을 위해 캔버스 다시 그리기
        this.core.markDirty();
    }
    
    /**
     * 선택 박스 종료
     */
    endSelectionBox() {
        console.debug('✅ 선택 박스 종료');
        
        this.state.isSelecting = false;
        
        // 선택 박스 내의 요소들 찾기
        const selectedElements = this.findElementsInBox(
            this.selectionBox.startX,
            this.selectionBox.startY,
            this.selectionBox.endX,
            this.selectionBox.endY
        );
        
        if (selectedElements.length > 0) {
            // Shift 키가 눌려있으면 기존 선택에 추가
            if (window.event.shiftKey) {
                for (const element of selectedElements) {
                    this.addToSelection(element);
                }
            } else {
                this.selectElements(selectedElements);
            }
        }
    }
    
    // ===== 선택 관리 =====
    
    /**
     * 요소 선택
     */
    selectElement(element) {
        this.core.setState({ selectedElements: [element] });
        console.debug('✓ 요소 선택:', element.id);
    }
    
    /**
     * 여러 요소 선택
     */
    selectElements(elements) {
        this.core.setState({ selectedElements: [...elements] });
        console.debug('✓ 요소 선택:', elements.length, '개');
    }
    
    /**
     * 선택에 추가
     */
    addToSelection(element) {
        if (!this.isSelected(element)) {
            const selectedElements = [...this.core.state.selectedElements, element];
            this.core.setState({ selectedElements });
            console.debug('+ 선택에 추가:', element.id);
        }
    }
    
    /**
     * 선택 토글
     */
    toggleSelection(element) {
        if (this.isSelected(element)) {
            const selectedElements = this.core.state.selectedElements.filter(
                el => el.id !== element.id
            );
            this.core.setState({ selectedElements });
            console.debug('- 선택에서 제거:', element.id);
        } else {
            this.addToSelection(element);
        }
    }
    
    /**
     * 전체 선택
     */
    selectAll() {
        this.core.setState({ selectedElements: [...this.core.state.elements] });
        console.debug('✓ 전체 선택:', this.core.state.elements.length, '개');
    }
    
    /**
     * 선택 해제
     */
    clearSelection() {
        this.core.setState({ selectedElements: [] });
        console.debug('✗ 선택 해제');
    }
    
    /**
     * 요소가 선택되었는지 확인
     */
    isSelected(element) {
        return this.core.state.selectedElements.some(el => el.id === element.id);
    }
    
    /**
     * 선택된 요소 삭제
     */
    deleteSelected() {
        const selectedIds = this.core.state.selectedElements.map(el => el.id);
        
        for (const id of selectedIds) {
            this.core.removeElement(id);
        }
        
        this.clearSelection();
        
        console.debug('🗑️ 선택 요소 삭제:', selectedIds.length, '개');
    }
    
    // ===== 호버 =====
    
    /**
     * 호버 업데이트
     */
    updateHover(canvasX, canvasY) {
        const hoveredElement = this.findElementAt(canvasX, canvasY);
        
        if (hoveredElement !== this.core.state.hoveredElement) {
            this.core.setState({ hoveredElement });
            
            if (hoveredElement) {
                this.canvas.style.cursor = 'pointer';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
    }
    
    // ===== 요소 찾기 =====
    
    /**
     * 특정 위치의 요소 찾기 (z-index 역순으로)
     */
    findElementAt(canvasX, canvasY) {
        const elements = [...this.core.state.elements].sort(
            (a, b) => (b.zIndex || 0) - (a.zIndex || 0)
        );
        
        for (const element of elements) {
            if (this.isPointInElement(canvasX, canvasY, element)) {
                return element;
            }
        }
        
        return null;
    }
    
    /**
     * 점이 요소 안에 있는지 확인
     */
    isPointInElement(x, y, element) {
        const ex = element.xCoordinate;
        const ey = element.yCoordinate;
        const ew = element.width || 100;
        const eh = element.height || 80;
        
        return x >= ex && x <= ex + ew && y >= ey && y <= ey + eh;
    }
    
    /**
     * 박스 내의 요소들 찾기
     */
    findElementsInBox(startX, startY, endX, endY) {
        // 화면 좌표를 캔버스 좌표로 변환
        const start = this.core.screenToCanvas(startX, startY);
        const end = this.core.screenToCanvas(endX, endY);
        
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        
        return this.core.state.elements.filter(element => {
            const ex = element.xCoordinate;
            const ey = element.yCoordinate;
            const ew = element.width || 100;
            const eh = element.height || 80;
            
            // 요소가 선택 박스와 겹치는지 확인
            return !(ex + ew < minX || ex > maxX || ey + eh < minY || ey > maxY);
        });
    }
    
    // ===== 유틸리티 =====
    
    /**
     * 마우스 위치 가져오기
     */
    getMousePos(e) {
        return {
            x: e.clientX,
            y: e.clientY
        };
    }
    
    /**
     * 컨텍스트 메뉴 표시
     */
    showContextMenu(canvasX, canvasY) {
        console.debug('📋 컨텍스트 메뉴:', canvasX, canvasY);
        // 나중에 UIManager에서 처리
    }
    
    // ===== 정리 =====
    
    /**
     * 리소스 정리
     */
    destroy() {
        console.log('🗑️ InteractionManager 정리 시작');
        
        // 이벤트 리스너 제거
        this.canvas.removeEventListener('mousedown', this.handlers.mousedown);
        this.canvas.removeEventListener('mousemove', this.handlers.mousemove);
        this.canvas.removeEventListener('mouseup', this.handlers.mouseup);
        this.canvas.removeEventListener('wheel', this.handlers.wheel);
        this.canvas.removeEventListener('contextmenu', this.handlers.contextmenu);
        
        window.removeEventListener('keydown', this.handlers.keydown);
        window.removeEventListener('keyup', this.handlers.keyup);
        
        document.removeEventListener('mouseup', this.handlers.mouseup);
        document.removeEventListener('mousemove', this.handlers.mousemove);
        
        console.log('✅ InteractionManager 정리 완료');
    }
}

