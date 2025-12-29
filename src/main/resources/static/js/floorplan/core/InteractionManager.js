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
     * @param {ElementManager} elementManager - ElementManager 인스턴스
     * @param {HistoryManager} historyManager - HistoryManager 인스턴스 (선택적)
     */
    constructor(core, elementManager, historyManager = null) {
        if (!core) {
            throw new Error('FloorPlanCore instance is required');
        }
        
        console.log('🎮 InteractionManager 초기화 시작');
        
        this.core = core;
        this.canvas = core.canvas;
        this.elementManager = elementManager;
        this.historyManager = historyManager;
        this.currentMode = null; // 현재 활성 모드 (삭제 콜백용)
        
        // 상태 플래그 (이벤트 충돌 방지)
        this.state = {
            isDragging: false,
            isPanning: false,
            isSelecting: false,
            isResizing: false,
            isRotating: false,
            isShiftPressed: false,
            isZooming: false
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
        
        // 줌 드래그 시작 정보
        this.zoomStart = {
            y: 0,
            zoom: 1.0
        };
        
        // 모바일 드래그 판별 상태 (요소 드래그 vs 팬 구분)
        this.mobileDrag = {
            pending: false,
            downX: 0,
            downY: 0,
            element: null // 드래그할 요소 (null이면 팬, 요소가 있으면 드래그)
        };
        
        // 모바일 클릭 판별 상태 (요소 생성 도구용)
        this.mobileClick = {
            isActive: false,
            startX: 0,
            startY: 0
        };
        
        // 핀치 줌 상태 (두 손가락 줌)
        this.pinchZoom = {
            isActive: false,
            initialDistance: 0,
            initialZoom: 1.0,
            centerX: 0,
            centerY: 0
        };
        
        // 선택 박스 정보
        this.selectionBox = {
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0
        };
        
        // 리사이즈 정보
        this.resizeStart = {
            element: null,
            handle: null,  // 'nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'
            originalX: 0,
            originalY: 0,
            originalWidth: 0,
            originalHeight: 0,
            startX: 0,
            startY: 0
        };
        
        // 회전 정보
        this.rotateStart = null;
        
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

    preventDefaultSafely(event) {
        if (event && event.cancelable) {
            event.preventDefault();
        }
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
        
        // 터치 이벤트(모바일/태블릿): 마우스 이벤트에 위임 및 핀치 줌 처리
        this.handlers.touchstart = (e) => {
            if (e.touches && e.touches.length > 0) {
                // 두 손가락 터치: 핀치 줌 시작
                if (e.touches.length === 2) {
                    this.startPinchZoom(e.touches);
                    this.preventDefaultSafely(e);
                    return;
                }
                
                // 단일 터치: 마우스 다운처럼 처리
                const touch = e.touches[0];
                this.onMouseDown({
                    preventDefault: () => this.preventDefaultSafely(e),
                    button: 0,
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    ctrlKey: false,
                    metaKey: false
                });
            }
        };
        this.handlers.touchmove = (e) => {
            if (e.touches && e.touches.length >= 2) {
                // 두 손가락 터치: 핀치 줌 업데이트
                this.updatePinchZoom(e.touches);
                this.preventDefaultSafely(e);
                return;
            }
            
            if (e.touches && e.touches.length > 0) {
                // 단일 터치: 마우스 이동처럼 처리
                const touch = e.touches[0];
                this.onMouseMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                this.preventDefaultSafely(e);
            }
        };
        this.handlers.touchend = (e) => {
            // 두 손가락이 모두 떨어졌거나 하나만 남은 경우 핀치 줌 종료
            if (this.pinchZoom.isActive && (e.touches.length < 2 || e.changedTouches.length >= 2)) {
                this.endPinchZoom();
                this.preventDefaultSafely(e);
                return;
            }
            
            // 터치 이벤트를 마우스 이벤트처럼 변환
            const touch = e.changedTouches && e.changedTouches.length > 0 
                ? e.changedTouches[0] 
                : (e.touches && e.touches.length > 0 ? e.touches[0] : null);
            
            if (touch) {
                this.onMouseUp({
                    preventDefault: () => this.preventDefaultSafely(e),
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    button: 0
                });
            } else {
                this.onMouseUp(e);
            }
        };
        this.canvas.addEventListener('touchstart', this.handlers.touchstart, { passive: false });
        this.canvas.addEventListener('touchmove', this.handlers.touchmove, { passive: false });
        this.canvas.addEventListener('touchend', this.handlers.touchend, { passive: false });
        
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
        this.preventDefaultSafely(e);
        
        const { x, y } = this.getMousePos(e);
        const canvasPos = this.core.screenToCanvas(x, y);
        const isMobileOrTablet = window.innerWidth <= 1200;
        
        console.debug('🖱️ 마우스 다운:', canvasPos);
        
        // 보기 모드일 때는 요소 선택/이동 비활성화 (팬/줌만 허용)
        const currentMode = this.core.state.currentMode;
        const isViewMode = currentMode === 'equipment-view' || currentMode === 'wireless-ap-view';
        
        // 도형 그리기 도구가 활성화된 경우 InteractionManager는 처리하지 않음
        const activeTool = this.core.state.activeTool;
        if (activeTool && ['rectangle', 'circle', 'line', 'dashed-line', 'entrance', 'stairs'].includes(activeTool)) {
            return; // ClassroomDesignMode에서 처리하도록 함
        }
        
        // Shift가 눌려있으면 팬 모드 (최우선)
        if (this.state.isShiftPressed || e.button === 1) { // 중간 버튼도 팬
            this.startPan(x, y);
            return;
        }
        
        // 보기 모드에서는 여기서 종료 (요소 선택/이동 불가)
        if (isViewMode) {
            return;
        }
        
        // 우클릭은 컨텍스트 메뉴
        if (e.button === 2) {
            this.showContextMenu(canvasPos.x, canvasPos.y);
            return;
        }
        
        // 선택된 요소가 있으면 먼저 핸들 확인 (회전 핸들은 요소 바깥에 있음)
        const selectedElement = this.core.state.selectedElements[0];
        if (selectedElement) {
            // 잠긴 요소는 리사이즈 불가
            if (selectedElement.isLocked) {
                console.debug('🔒 잠긴 요소는 리사이즈 불가:', selectedElement.id);
            } else {
                const handle = this.findResizeHandle(canvasPos.x, canvasPos.y, selectedElement);
                if (handle) {
                    console.debug('🎯 핸들 클릭:', handle, '| 요소:', selectedElement.id);
                    // 모바일/태블릿에서도 리사이즈는 즉시 시작 (드래그와 구분)
                    this.startResize(x, y, selectedElement, handle);
                    return;
                }
            }
        }
        
        // 요소 위에서 클릭했는지 확인
        const clickedElement = this.findElementAt(canvasPos.x, canvasPos.y);
        
        if (clickedElement) {
            // 잠긴 요소는 드래그/리사이즈 불가
            if (clickedElement.isLocked) {
                console.debug('🔒 잠긴 요소는 이동/조작 불가:', clickedElement.id);
                return;
            }
            
            // 선택된 요소의 리사이즈 핸들 확인 (중복 확인 제거됨 - 위에서 이미 확인)
            // (회전 핸들이 아닌 일반 리사이즈 핸들은 요소 위에 있으므로 여기서도 확인)
            
            // 요소 클릭: 단일 또는 다중 선택
            if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd + 클릭: 다중 선택 토글
                this.toggleSelection(clickedElement);
            } else {
                // 일반 클릭: 단일 선택
                if (!this.isSelected(clickedElement)) {
                    this.selectElement(clickedElement);
                }
            }
            
            // 모바일/태블릿: 요소 드래그를 위한 지연 처리 (리사이즈 핸들과 구분)
            if (isMobileOrTablet) {
                // 요소 드래그를 위한 마커 설정 (리사이즈 핸들이 아닐 때만)
                this.mobileDrag.pending = true;
                this.mobileDrag.downX = x;
                this.mobileDrag.downY = y;
                this.mobileDrag.element = clickedElement; // 드래그할 요소 저장
            } else {
                // 데스크탑: Ctrl 클릭이 아닐 때만 드래그 시작
                if (!e.ctrlKey && !e.metaKey) {
            this.startDrag(x, y);
                }
            }
        } else {
        // 빈 공간 클릭: (모바일/태블릿은 팬, 데스크톱은 선택 박스)
        // 기존 선택이 있으면 즉시 해제
        if (this.core.state.selectedElements && this.core.state.selectedElements.length > 0) {
            this.clearSelection();
        }
        if (e.ctrlKey || e.metaKey) {
                // Ctrl 누른 채로 빈 공간 클릭: 아무것도 안 함 (기존 선택 유지)
                return;
            }
        
        // 요소 생성 도구가 활성화된 경우 팬/선택박스를 시작하지 않음 (클릭 이벤트로 처리)
        const activeTool = this.core.state.activeTool;
        const isCreationTool = activeTool && ['building', 'room', 'toilet', 'elevator', 'mdf-idf'].includes(activeTool);
        
        if (isCreationTool) {
            console.log('🛠️ 요소 생성 도구 활성화됨:', {
                activeTool,
                isMobileOrTablet,
                clickPos: { x, y }
            });
            
            // 요소 생성 도구가 활성화된 경우 클릭 이벤트가 발생하도록 함
            if (isMobileOrTablet) {
                // 모바일/태블릿: 실제 클릭인지 확인하기 위해 마커 설정 (onMouseUp에서 확인)
                this.mobileClick.startX = x;
                this.mobileClick.startY = y;
                this.mobileClick.isActive = true;
                console.log('📱 모바일 클릭 마커 설정:', {
                    startX: this.mobileClick.startX,
                    startY: this.mobileClick.startY,
                    isActive: this.mobileClick.isActive
                });
            } else {
                // PC: 클릭 이벤트가 발생하도록 preventDefault를 호출하지 않음
                // 하지만 이미 preventDefault가 호출되었으므로, 클릭 이벤트를 수동으로 발생시킴
                // 대신 onMouseUp에서 클릭 이벤트를 발생시키도록 처리
                this.mobileClick.startX = x;
                this.mobileClick.startY = y;
                this.mobileClick.isActive = true;
                console.log('🖥️ PC 클릭 마커 설정:', {
                    startX: this.mobileClick.startX,
                    startY: this.mobileClick.startY,
                    isActive: this.mobileClick.isActive
                });
            }
            return; // 팬/선택박스 시작하지 않음
        }
        
        // 빈 공간 드래그 시 선택 박스 시작 (모바일/태블릿도 포함)
        // 팬은 Shift 키를 누른 상태에서만 가능
            this.startSelectionBox(x, y);
        }
    }
    
    /**
     * 마우스 이동
     */
    onMouseMove(e) {
        const { x, y } = this.getMousePos(e);
        const canvasPos = this.core.screenToCanvas(x, y);
        
        // 마우스 위치 저장 (드래그/리사이즈 종료 후 호버 업데이트용)
        this.lastMousePos = { x, y };
        
        // 줌 드래그 중
        if (this.state.isZooming) {
            this.updateZoom(y);
            return;
        }
        
        // 회전 중
        if (this.state.isRotating) {
            this.updateRotate(x, y);
            return;
        }
        
        // 리사이즈 중
        if (this.state.isResizing) {
            this.updateResize(x, y);
            return;
        }
        
        // 모바일/태블릿: 드래그 임계치 초과 시 요소 드래그 또는 팬 시작
        const isMobileOrTablet = window.innerWidth <= 1200;
        if (isMobileOrTablet && this.mobileDrag.pending && !this.state.isPanning && !this.state.isDragging) {
            const dx = x - this.mobileDrag.downX;
            const dy = y - this.mobileDrag.downY;
            const dist2 = dx * dx + dy * dy;
            if (dist2 > 36) { // 약 6px 이상 이동
                // 요소 위에서 시작한 드래그인지 확인
                if (this.mobileDrag.element) {
                    // 요소 드래그 시작
                    console.log('📱 요소 드래그 시작:', this.mobileDrag.element.id);
                    this.startDrag(this.mobileDrag.downX, this.mobileDrag.downY);
                } else {
                    // 빈 공간에서 시작한 드래그 → 팬 시작
                    console.log('📱 팬 시작');
                    this.startPan(this.mobileDrag.downX, this.mobileDrag.downY);
                }
                // 드래그/팬이 시작되면 클릭 처리를 취소
                this.mobileClick.isActive = false;
            }
        }
        
        // 요소 생성 도구 클릭 중 팬/선택박스 시작 시 취소
        if (this.mobileClick.isActive && !this.state.isPanning && !this.state.isSelecting) {
            const dx = x - this.mobileClick.startX;
            const dy = y - this.mobileClick.startY;
            const dist2 = dx * dx + dy * dy;
            if (dist2 > 36) { // 약 6px 이상 이동 시 팬/선택박스 시작
                if (isMobileOrTablet) {
                    this.startPan(this.mobileClick.startX, this.mobileClick.startY);
                } else {
                    this.startSelectionBox(this.mobileClick.startX, this.mobileClick.startY);
                }
                this.mobileClick.isActive = false;
            }
        }
        
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
        
        // 호버 처리 (커서 변경 포함)
        this.updateHover(canvasPos.x, canvasPos.y);
    }
    
    /**
     * 마우스 업
     */
    onMouseUp(e) {
        console.debug('🖱️ 마우스 업');
        this.mobileDrag.pending = false;
        this.mobileDrag.element = null; // 요소 드래그 마커 리셋
        
        // 모든 환경에서 요소 생성 도구 클릭 처리 (모바일/태블릿/PC)
        if (this.mobileClick.isActive) {
            const { x, y } = this.getMousePos(e);
            const dx = x - this.mobileClick.startX;
            const dy = y - this.mobileClick.startY;
            const distanceSq = dx * dx + dy * dy;
            
            console.log('🖱️ 모바일 클릭 확인:', {
                isActive: this.mobileClick.isActive,
                startPos: { x: this.mobileClick.startX, y: this.mobileClick.startY },
                endPos: { x, y },
                distance: Math.sqrt(distanceSq),
                isPanning: this.state.isPanning,
                isDragging: this.state.isDragging,
                isSelecting: this.state.isSelecting,
                activeTool: this.core.state.activeTool
            });
            
            // 실제 클릭인지 확인 (6px 이내 이동)
            if (distanceSq <= 36 && !this.state.isPanning && !this.state.isDragging && !this.state.isSelecting) {
                // 실제 클릭이었으므로 요소 생성 도구 클릭 이벤트 발생
                const activeTool = this.core.state.activeTool;
                if (activeTool && ['building', 'room', 'toilet', 'elevator', 'mdf-idf'].includes(activeTool)) {
                    console.log('✅ 요소 생성 클릭 이벤트 발생:', { x, y, activeTool });
                    // ClassroomDesignMode의 handleCanvasClick을 호출하기 위해 클릭 이벤트 생성
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        clientX: x,
                        clientY: y,
                        button: 0
                    });
                    this.canvas.dispatchEvent(clickEvent);
                    console.log('📤 클릭 이벤트 디스패치 완료');
                } else {
                    console.warn('⚠️ 활성 도구가 요소 생성 도구가 아님:', activeTool);
                }
            } else {
                console.log('❌ 클릭이 아님 (드래그/팬/선택으로 판단):', {
                    distanceSq,
                    isPanning: this.state.isPanning,
                    isDragging: this.state.isDragging,
                    isSelecting: this.state.isSelecting
                });
            }
            
            this.mobileClick.isActive = false;
        }
        
        // 줌 종료
        if (this.state.isZooming) {
            this.endZoom();
        }
        
        // 회전 종료
        if (this.state.isRotating) {
            this.endRotate();
        }
        
        // 리사이즈 종료
        if (this.state.isResizing) {
            this.endResize();
        }
        
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
        
        // Ctrl + 휠: 줌
        if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY;
        
        // 줌 레벨 계산
        const zoomFactor = delta > 0 ? 1.1 : 0.9;
        const newZoom = this.core.state.zoom * zoomFactor;
        
        // 마우스 위치를 중심으로 줌
        this.core.setZoom(newZoom, x, y);
            
            // 줌 디스플레이 업데이트
            if (window.floorPlanApp && window.floorPlanApp.updateZoomDisplay) {
                window.floorPlanApp.updateZoomDisplay();
            }
        
        console.debug('🔍 줌:', newZoom.toFixed(2));
            return;
        }
        
        // Alt + 휠: 좌우 스크롤
        if (e.altKey) {
            const deltaX = e.deltaY; // 세로 휠을 가로 이동으로 변환
            const newPanX = this.core.state.panX - deltaX;
            
            this.core.setPan(newPanX, this.core.state.panY);
            console.debug('↔️ 좌우 스크롤:', newPanX.toFixed(2));
            return;
        }
        
        // 일반 휠: 상하 스크롤
        const deltaY = e.deltaY;
        const newPanY = this.core.state.panY - deltaY;
        
        this.core.setPan(this.core.state.panX, newPanY);
        console.debug('↕️ 상하 스크롤:', newPanY.toFixed(2));
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
        // Shift: 팬 모드
        if (e.shiftKey && !this.state.isShiftPressed) {
            this.state.isShiftPressed = true;
            this.canvas.style.cursor = 'grab';
            
            // 도구 선택 해제 (팬 모드에서는 요소 생성 불가)
            if (this.core.state.activeTool) {
                this.core.setState({ activeTool: null });
                console.log('🔧 Shift 누름: 도구 선택 해제');
            }
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
        
        // Ctrl/Cmd + C: 복사 (교실 설계 모드에서만 도형 요소 복사)
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
            const currentMode = this.core.state.currentMode;
            if (currentMode === 'design-classroom') {
                e.preventDefault();
                const selectedElements = this.core.state.selectedElements || [];
                if (selectedElements.length > 0) {
                    this.elementManager.copyElements(selectedElements);
                    // 알림 표시 (UI 매니저가 있으면)
                    if (this.uiManager) {
                        this.uiManager.showNotification(`${selectedElements.length}개 요소 복사됨`, 'success');
                    }
                }
            }
        }
        
        // Ctrl/Cmd + V: 붙여넣기 (교실 설계 모드에서만)
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
            const currentMode = this.core.state.currentMode;
            if (currentMode === 'design-classroom') {
                e.preventDefault();
                const pastedElements = this.elementManager.pasteElements();
                if (pastedElements.length > 0) {
                    // 알림 표시
                    if (this.uiManager) {
                        this.uiManager.showNotification(`${pastedElements.length}개 요소 붙여넣기됨`, 'success');
                    }
                    // 히스토리 추가
                    if (this.historyManager) {
                        this.historyManager.addState({
                            type: 'paste',
                            elements: pastedElements
                        });
                    }
                }
            }
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
        // Shift 해제
        if (!e.shiftKey && this.state.isShiftPressed) {
            this.state.isShiftPressed = false;
            // 팬 중이 아니면 커서를 기본으로 변경
            if (!this.state.isPanning) {
            this.canvas.style.cursor = 'default';
            }
        }
    }
    
    // ===== 드래그 =====
    
    /**
     * 드래그 시작
     */
    startDrag(x, y) {
        // 선택된 요소 중 잠긴 요소가 있으면 드래그 불가
        const selectedElements = this.core.state.selectedElements;
        const hasLockedElement = selectedElements.some(el => el.isLocked);
        if (hasLockedElement) {
            console.debug('🔒 잠긴 요소는 드래그 불가');
            return;
        }
        
        // 히스토리 저장 (작업 전 상태 저장)
        if (this.historyManager) {
            this.historyManager.saveState('작업 전');
        }
        
        this.state.isDragging = true;
        
        // Core 상태 업데이트: isDragging = true, hoveredElement = null (중요!)
        this.core.state.isDragging = true;  // 즉시 직접 설정
        this.core.state.hoveredElement = null;  // 즉시 직접 설정
        
        this.dragStart.x = x;
        this.dragStart.y = y;
        this.dragStart.elements = [...selectedElements];
        
            // 원래 위치 저장 (부모 요소 + 자식 요소 모두)
        this.dragStart.originalPositions.clear();
        for (const element of this.dragStart.elements) {
                // 부모 요소의 원래 위치 저장
            const posData = {
                x: element.xCoordinate,
                y: element.yCoordinate
            };
            
            // 선/점선의 경우 startX, startY, endX, endY도 저장
            if (element.elementType === 'shape' && (element.shapeType === 'line' || element.shapeType === 'dashed-line')) {
                posData.startX = element.startX || element.xCoordinate;
                posData.startY = element.startY || element.yCoordinate;
                posData.endX = element.endX || (element.xCoordinate + (element.width || 0));
                posData.endY = element.endY || (element.yCoordinate + (element.height || 0));
            }
            
            this.dragStart.originalPositions.set(element.id, posData);
                
                // 부모 요소가 building, room, 또는 seat이면, 자식(name_box)의 원래 위치와 상대 위치도 저장
                if (element.elementType === 'building' || element.elementType === 'room' || element.elementType === 'seat') {
                    const children = this.core.state.elements.filter(e => e.parentElementId === element.id);
                    for (const child of children) {
                        // 절대 위치와 부모 기준 상대 위치(offset) 모두 저장
                        const offsetX = child.xCoordinate - element.xCoordinate;
                        const offsetY = child.yCoordinate - element.yCoordinate;
                        
                        this.dragStart.originalPositions.set(child.id, {
                            x: child.xCoordinate,
                            y: child.yCoordinate,
                            offsetX: offsetX, // 부모 기준 상대 X
                            offsetY: offsetY  // 부모 기준 상대 Y
                        });
                        
                        console.debug('📌 자식 상대 위치 저장:', child.id, 'offset:', offsetX.toFixed(2), offsetY.toFixed(2));
                    }
                }
        }
        
        this.canvas.style.cursor = 'move';
        
        // 즉시 강제 렌더링 (선택 효과 제거를 즉시 반영)
        this.core.markDirty();
        this.core.render();  // 동기적으로 즉시 렌더링
        
        console.debug('🚀 드래그 시작 + 자식 포함:', this.dragStart.elements.length, '개 요소 +', this.dragStart.originalPositions.size - this.dragStart.elements.length, '개 자식');
    }
    
    /**
     * 드래그 업데이트
     */
    updateDrag(x, y) {
        // 드래그 상태 확인
        if (!this.state.isDragging) return;
        
        console.debug('🔄 드래그 업데이트 중 | isDragging:', this.state.isDragging, '| core.isDragging:', this.core.state.isDragging);
        
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
                
                // AP의 경우 부모 교실 경계 체크
                if (element.elementType === 'wireless_ap' && element.parentElementId) {
                    const parent = this.core.state.elements.find(e => e.id === element.parentElementId);
                    if (parent && parent.elementType === 'room') {
                        // AP는 교실 내부에만 위치할 수 있음
                        const apWidth = element.width || (element.radius ? element.radius * 2 : 40);
                        const apHeight = element.height || (element.radius ? element.radius * 2 : 40);
                        
                        const minX = parent.xCoordinate;
                        const minY = parent.yCoordinate;
                        const maxX = parent.xCoordinate + parent.width - apWidth;
                        const maxY = parent.yCoordinate + parent.height - apHeight;
                        
                        newX = Math.max(minX, Math.min(maxX, newX));
                        newY = Math.max(minY, Math.min(maxY, newY));
                    }
                }
                
                // 이름박스의 경우 부모 요소 경계 체크 (건물의 이름박스는 제외)
                if (element.elementType === 'name_box' && element.parentElementId) {
                    const parent = this.core.state.elements.find(e => e.id === element.parentElementId);
                    if (parent && parent.elementType !== 'building') {
                        // 건물이 아닌 부모의 이름박스만 경계 제한
                        const minX = parent.xCoordinate;
                        const minY = parent.yCoordinate;
                        const maxX = parent.xCoordinate + parent.width - element.width;
                        const maxY = parent.yCoordinate + parent.height - element.height;
                        
                        newX = Math.max(minX, Math.min(maxX, newX));
                        newY = Math.max(minY, Math.min(maxY, newY));
                    }
                    // 건물의 이름박스는 경계 제한 없음 (캔버스 경계만 체크)
                }
                
                // 모든 요소에 대해 캔버스 경계 체크
                const canvasWidth = this.core.state.canvasWidth;
                const canvasHeight = this.core.state.canvasHeight;
                const elementWidth = element.width || 0;
                const elementHeight = element.height || 0;
                
                newX = Math.max(0, Math.min(canvasWidth - elementWidth, newX));
                newY = Math.max(0, Math.min(canvasHeight - elementHeight, newY));
                
                // 선/점선의 경우 startX, startY, endX, endY도 함께 업데이트
                if (element.elementType === 'shape' && (element.shapeType === 'line' || element.shapeType === 'dashed-line')) {
                    // originalPos에서 원래 좌표 가져오기
                    const originalStartX = originalPos.startX;
                    const originalStartY = originalPos.startY;
                    const originalEndX = originalPos.endX;
                    const originalEndY = originalPos.endY;
                    
                    const newStartX = originalStartX + dx_canvas;
                    const newStartY = originalStartY + dy_canvas;
                    const newEndX = originalEndX + dx_canvas;
                    const newEndY = originalEndY + dy_canvas;
                    
                    // width와 height 재계산
                    const newWidth = Math.abs(newEndX - newStartX);
                    const newHeight = Math.abs(newEndY - newStartY);
                    
                    this.core.updateElement(element.id, {
                        xCoordinate: Math.min(newStartX, newEndX),
                        yCoordinate: Math.min(newStartY, newEndY),
                        width: newWidth,
                        height: newHeight,
                        startX: newStartX,
                        startY: newStartY,
                        endX: newEndX,
                        endY: newEndY
                    });
                } else {
                    // 일반 요소 업데이트
                this.core.updateElement(element.id, {
                    xCoordinate: newX,
                    yCoordinate: newY
                });
            }
                
                // 부모 요소가 이동하면 자식 요소(name_box)도 함께 이동
                if (element.elementType === 'building' || element.elementType === 'room' || element.elementType === 'seat') {
                    const children = this.core.state.elements.filter(e => e.parentElementId === element.id);
                    for (const child of children) {
                        const childOriginalPos = this.dragStart.originalPositions.get(child.id);
                        if (childOriginalPos && childOriginalPos.offsetX !== undefined && childOriginalPos.offsetY !== undefined) {
                            // 부모의 새 위치 + 상대 위치(offset)로 자식 위치 계산
                            // 이렇게 하면 상대 위치가 정확히 유지됨
                            let childNewX = newX + childOriginalPos.offsetX;
                            let childNewY = newY + childOriginalPos.offsetY;
                            
                            // 건물의 이름박스는 경계 제한 없음, 교실/자리의 이름박스만 제한
                            if (element.elementType === 'building' || child.elementType !== 'name_box') {
                                // 건물이거나 이름박스가 아닌 자식: 경계 제한 없음 (캔버스 경계만 체크)
                                const canvasWidth = this.core.state.canvasWidth;
                                const canvasHeight = this.core.state.canvasHeight;
                                const childWidth = child.width || 0;
                                const childHeight = child.height || 0;
                                
                                childNewX = Math.max(0, Math.min(canvasWidth - childWidth, childNewX));
                                childNewY = Math.max(0, Math.min(canvasHeight - childHeight, childNewY));
                            } else {
                                // 교실/자리의 이름박스: 부모 요소 내부로 제한
                                const minX = newX;
                                const minY = newY;
                                const maxX = newX + element.width - child.width;
                                const maxY = newY + element.height - child.height;
                                
                                const beforeClampX = childNewX;
                                const beforeClampY = childNewY;
                                
                                childNewX = Math.max(minX, Math.min(maxX, childNewX));
                                childNewY = Math.max(minY, Math.min(maxY, childNewY));
                                
                                // 경계에 걸려서 clamp된 경우만 로그 출력
                                if (childNewX !== beforeClampX || childNewY !== beforeClampY) {
                                    console.debug('⚠️ 자식 위치 제한됨:', child.id, 'before:', beforeClampX.toFixed(2), beforeClampY.toFixed(2), '→ after:', childNewX.toFixed(2), childNewY.toFixed(2));
                                }
                            }
                            
                            this.core.updateElement(child.id, {
                                xCoordinate: childNewX,
                                yCoordinate: childNewY
                            });
                        }
                    }
                }
            }
        }
        
        // 강제 리렌더링
        this.core.markDirty();
    }
    
    /**
     * 드래그 종료
     */
    endDrag() {
        console.debug('✅ 드래그 종료 | 변경 전 isDragging:', this.state.isDragging, '| core.isDragging:', this.core.state.isDragging);
        
        // 무선AP 위치 업데이트 (드래그된 무선AP 요소의 위치를 savedApPositions에 저장)
        const draggedElements = this.dragStart.elements || [];
        draggedElements.forEach(draggedElement => {
            if (draggedElement.elementType === 'wireless_ap' && draggedElement.referenceId) {
                // 최신 요소 상태 가져오기 (드래그 후 업데이트된 위치 반영)
                const latestElement = this.core.state.elements.find(e => e.id === draggedElement.id);
                if (latestElement) {
                    // WirelessApDesignMode의 updateApPosition 메서드 호출
                    const app = window.floorPlanApp;
                    if (app && app.modeManager && typeof app.modeManager.updateApPosition === 'function') {
                        app.modeManager.updateApPosition(latestElement);
                    }
                }
            }
        });
        
        this.state.isDragging = false;
        this.core.state.isDragging = false;  // 즉시 직접 설정
        this.canvas.style.cursor = 'default';
        
        // 즉시 강제 렌더링 (선택 효과 다시 표시)
        this.core.markDirty();
        this.core.render();  // 동기적으로 즉시 렌더링
        
        // 드래그 종료 후 현재 마우스 위치에서 호버 업데이트 (회전 핸들 감지용)
        // 렌더링 완료 후 호버 업데이트 (요소 위치 업데이트 반영)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (this.lastMousePos) {
                    const canvasPos = this.core.screenToCanvas(this.lastMousePos.x, this.lastMousePos.y);
                    console.debug('🔄 드래그 종료 후 호버 업데이트:', {
                        mousePos: this.lastMousePos,
                        canvasPos: canvasPos,
                        selectedElement: this.core.state.selectedElements[0]?.id
                    });
                    this.updateHover(canvasPos.x, canvasPos.y);
                }
            });
        });
        
        console.debug('✅ 드래그 종료 + 즉시 렌더링 | isDragging:', this.state.isDragging, '| core.isDragging:', this.core.state.isDragging);
        
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
     * 팬 업데이트 (상하좌우 이동)
     */
    updatePan(x, y) {
        const dx = x - this.panStart.x;
        const dy = y - this.panStart.y;
        
        // X축, Y축 모두 이동
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
    
    // ===== 줌 드래그 =====
    
    /**
     * 줌 드래그 시작
     */
    startZoom(y) {
        this.state.isZooming = true;
        
        this.zoomStart.y = y;
        this.zoomStart.zoom = this.core.state.zoom;
        
        this.canvas.style.cursor = 'ns-resize';
        
        console.debug('🔍 줌 드래그 시작');
    }
    
    /**
     * 줌 드래그 업데이트
     */
    updateZoom(y) {
        const dy = this.zoomStart.y - y; // 위로 드래그 = 확대
        
        // 드래그 거리를 줌 변화량으로 변환 (100px = 1배)
        const zoomDelta = dy / 100;
        const newZoom = this.zoomStart.zoom * Math.pow(1.5, zoomDelta);
        
        // 줌 범위 제한 (동적 최소 줌 사용)
        const minZoom = this.core.getMinZoomToFitCanvas();
        const maxZoom = 5.0; // FloorPlanCore.MAX_ZOOM
        const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
        
        this.core.setState({ zoom: clampedZoom });
        this.core.markDirty();
        
        // 줌 디스플레이 업데이트 (main_new_v3.js의 updateZoomDisplay 호출)
        if (window.floorPlanApp && window.floorPlanApp.updateZoomDisplay) {
            window.floorPlanApp.updateZoomDisplay();
        }
    }
    
    /**
     * 줌 드래그 종료
     */
    endZoom() {
        console.debug('✅ 줌 드래그 종료');
        
        this.state.isZooming = false;
        this.canvas.style.cursor = 'default';
    }
    
    // ===== 핀치 줌 (두 손가락 줌) =====
    
    /**
     * 두 손가락 사이의 거리 계산
     */
    getTouchDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * 두 손가락의 중점 계산
     */
    getTouchCenter(touch1, touch2) {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    }
    
    /**
     * 핀치 줌 시작
     */
    startPinchZoom(touches) {
        if (touches.length < 2) return;
        
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        this.pinchZoom.isActive = true;
        this.pinchZoom.initialDistance = this.getTouchDistance(touch1, touch2);
        this.pinchZoom.initialZoom = this.core.state.zoom;
        
        const center = this.getTouchCenter(touch1, touch2);
        this.pinchZoom.centerX = center.x;
        this.pinchZoom.centerY = center.y;
        
        // 다른 상호작용 중단
        this.state.isPanning = false;
        this.state.isDragging = false;
        this.mobileDrag.pending = false;
        this.mobileClick.isActive = false;
        
        console.debug('🤏 핀치 줌 시작:', {
            initialDistance: this.pinchZoom.initialDistance,
            initialZoom: this.pinchZoom.initialZoom,
            center: { x: this.pinchZoom.centerX, y: this.pinchZoom.centerY }
        });
    }
    
    /**
     * 핀치 줌 업데이트
     */
    updatePinchZoom(touches) {
        if (!this.pinchZoom.isActive || touches.length < 2) return;
        
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        const currentDistance = this.getTouchDistance(touch1, touch2);
        const center = this.getTouchCenter(touch1, touch2);
        
        // 거리 비율에 따라 줌 계산
        const distanceRatio = currentDistance / this.pinchZoom.initialDistance;
        const newZoom = this.pinchZoom.initialZoom * distanceRatio;
        
        // 줌 범위 제한
        const minZoom = this.core.getMinZoomToFitCanvas();
        const maxZoom = 5.0; // FloorPlanCore.MAX_ZOOM
        const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
        
        // 중점을 기준으로 줌 (중점이 화면에서 고정되도록 pan 조정)
        if (typeof this.core.setZoom === 'function') {
            this.core.setZoom(clampedZoom, center.x, center.y);
        } else {
            // setZoom이 없으면 수동으로 pan 계산
            const currentZoom = this.core.state.zoom;
            
            // 중점의 캔버스 좌표 계산
            const canvasCenterX = (center.x - this.core.state.panX) / currentZoom;
            const canvasCenterY = (center.y - this.core.state.panY) / currentZoom;
            
            // 새로운 줌에서 같은 캔버스 지점이 중점에 오도록 pan 조정
            const newPanX = center.x - canvasCenterX * clampedZoom;
            const newPanY = center.y - canvasCenterY * clampedZoom;
            
            this.core.setState({
                zoom: clampedZoom,
                panX: newPanX,
                panY: newPanY
            });
        }
        
        this.core.markDirty();
        this.core.render && this.core.render();
        
        // 줌 디스플레이 업데이트
        if (window.floorPlanApp && window.floorPlanApp.updateZoomDisplay) {
            window.floorPlanApp.updateZoomDisplay();
        }
        
        console.debug('🤏 핀치 줌 업데이트:', {
            distanceRatio: distanceRatio.toFixed(2),
            zoom: clampedZoom.toFixed(2)
        });
    }
    
    /**
     * 핀치 줌 종료
     */
    endPinchZoom() {
        if (!this.pinchZoom.isActive) return;
        
        this.pinchZoom.isActive = false;
        this.pinchZoom.initialDistance = 0;
        this.pinchZoom.initialZoom = 1.0;
        this.pinchZoom.centerX = 0;
        this.pinchZoom.centerY = 0;
        
        console.debug('✅ 핀치 줌 종료');
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
        
        // 화면 좌표를 캔버스 좌표로 변환
        const canvasStart = this.core.screenToCanvas(x, y);
        
        // Core state에도 저장 (렌더링용 - 캔버스 좌표)
        this.core.setState({ 
            selectionBox: {
                startX: canvasStart.x,
                startY: canvasStart.y,
                endX: canvasStart.x,
                endY: canvasStart.y
            }
        });
        
        // 기존 선택 해제
        this.clearSelection();
        
        console.debug('📦 선택 박스 시작');
    }
    
    /**
     * 선택 박스 업데이트
     */
    updateSelectionBox(x, y) {
        this.selectionBox.endX = x;
        this.selectionBox.endY = y;
        
        // 화면 좌표를 캔버스 좌표로 변환
        const canvasStart = this.core.screenToCanvas(this.selectionBox.startX, this.selectionBox.startY);
        const canvasEnd = this.core.screenToCanvas(x, y);
        
        // Core state 업데이트 (캔버스 좌표)
        this.core.setState({ 
            selectionBox: {
                startX: canvasStart.x,
                startY: canvasStart.y,
                endX: canvasEnd.x,
                endY: canvasEnd.y
            }
        });
        
        // 선택 박스 렌더링을 위해 캔버스 다시 그리기
        this.core.markDirty();
    }
    
    /**
     * 선택 박스 종료
     */
    endSelectionBox() {
        console.debug('✅ 선택 박스 종료');
        
        this.state.isSelecting = false;
        
        // Core state에서 선택 박스 제거
        this.core.setState({ selectionBox: null });
        
        // 선택 박스 내의 요소들 찾기
        const selectedElements = this.findElementsInBox(
            this.selectionBox.startX,
            this.selectionBox.startY,
            this.selectionBox.endX,
            this.selectionBox.endY
        );
        
        if (selectedElements.length > 0) {
                this.selectElements(selectedElements);
            }
        
        // 캔버스 다시 그리기
        this.core.markDirty();
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
     * 선택된 요소 삭제 (자식 요소도 함께 삭제)
     */
    deleteSelected() {
        const selectedElements = [...this.core.state.selectedElements];
        
        // 삭제할 요소가 없으면 리턴
        if (selectedElements.length === 0) {
            return;
        }
        
        // 잠긴 요소가 있으면 삭제 불가
        const hasLockedElement = selectedElements.some(el => el.isLocked);
        if (hasLockedElement) {
            console.debug('🔒 잠긴 요소는 삭제 불가');
            return;
        }
        
        // 히스토리 저장 (작업 전 상태 저장)
        if (this.historyManager) {
            this.historyManager.saveState('작업 전');
        }
        
        // 실제로 삭제될 모든 요소 수집 (자식 포함)
        const allDeletedElements = [];
        
        // ElementManager를 통해 삭제 (자식 요소도 함께 삭제됨)
        selectedElements.forEach(element => {
            allDeletedElements.push(element);
            
            // 자식 요소도 수집
            const children = this.core.state.elements.filter(el => el.parentElementId === element.id);
            allDeletedElements.push(...children);
            
            // ElementManager가 없으면 core를 통해 직접 삭제
            if (this.core.elementManager) {
                this.core.elementManager.deleteElement(element.id);
            } else {
                // 자식 요소 삭제
                children.forEach(child => this.core.removeElement(child.id));
                
                // 부모 요소 삭제
                this.core.removeElement(element.id);
            }
        });
        
        this.clearSelection();
        
        console.log('🗑️ 요소 삭제 완료:', selectedElements.length, '개 (자식 포함:', allDeletedElements.length, '개)');
        console.log('🔍 삭제된 요소 목록:', allDeletedElements.map(el => ({
            type: el.elementType,
            id: el.id,
            classroomId: el.classroomId,
            label: el.label
        })));
        
        // 요소 삭제 후 localElementsByPage 업데이트 (페이지 전환 시 삭제 상태 유지)
        const app = window.floorPlanApp;
        if (app && app.localElementsByPage && app.currentPage) {
            // 현재 페이지의 모든 요소 저장 (삭제 후 상태 반영)
            const currentPageElements = this.core.state.elements.filter(el => {
                if (!el || (!el.id && !el.elementType)) return false;
                const elPage = el.pageNumber || app.currentPage;
                return elPage === app.currentPage;
            });
            
            // 빈 배열이어도 저장 (삭제 상태 반영)
            app.localElementsByPage[app.currentPage] = JSON.parse(JSON.stringify(currentPageElements));
            console.log(`💾 페이지 ${app.currentPage}의 요소 ${currentPageElements.length}개 저장 (삭제 후 로컬 상태 업데이트)`);
        }
        
        // 현재 모드에 삭제 알림 (미배치 교실 복원용)
        if (this.currentMode && typeof this.currentMode.onElementsDeleted === 'function') {
            console.log('📞 currentMode.onElementsDeleted 콜백 호출 시작');
            this.currentMode.onElementsDeleted(allDeletedElements);
            console.log('✅ currentMode.onElementsDeleted 콜백 호출 완료');
        } else {
            console.warn('⚠️ currentMode 또는 onElementsDeleted 콜백이 없음:', {
                currentMode: !!this.currentMode,
                hasCallback: this.currentMode && typeof this.currentMode.onElementsDeleted === 'function'
            });
        }
    }
    
    // ===== 호버 =====
    
    /**
     * 호버 업데이트
     */
    updateHover(canvasX, canvasY) {
        const hoveredElement = this.findElementAt(canvasX, canvasY);
        
        // 드래그/리사이즈 중에는 호버 효과를 표시하지 않음
        if (this.core.state.isDragging || this.core.state.isResizing) {
            if (this.core.state.hoveredElement !== null) {
                this.core.setState({ hoveredElement: null }); // 호버 상태 강제 해제
                this.core.markDirty();
            }
            return;
        }
        
        // 도구가 활성화된 경우 (십자 커서 유지)
        if (this.core.state.activeTool) {
            // 호버 상태만 업데이트, 커서는 변경하지 않음
        if (hoveredElement !== this.core.state.hoveredElement) {
            this.core.setState({ hoveredElement });
            }
            // 커서를 crosshair로 강제 설정
            if (this.canvas.style.cursor !== 'crosshair') {
                this.canvas.style.cursor = 'crosshair';
            }
            return;
        }
        
        if (hoveredElement !== this.core.state.hoveredElement) {
            this.core.setState({ hoveredElement });
        }
        
        // 리사이즈 핸들 호버 시 커서 변경
        if (this.core.state.selectedElements.length === 1 && hoveredElement === this.core.state.selectedElements[0]) {
            const handle = this.findResizeHandle(canvasX, canvasY, hoveredElement);
            if (handle) {
                this.canvas.style.cursor = this.getResizeCursor(handle);
                return;
            }
        }
        
        // 요소 위에 호버 시 커서 변경
            if (hoveredElement) {
                this.canvas.style.cursor = 'pointer';
            } else {
                this.canvas.style.cursor = 'default';
        }
    }
    
    // ===== 요소 찾기 =====
    
    /**
     * 특정 위치의 요소 찾기 (z-index 역순으로, name_box 우선)
     */
    findElementAt(canvasX, canvasY) {
        const elements = [...this.core.state.elements].sort(
            (a, b) => (b.zIndex || 0) - (a.zIndex || 0)
        );
        
        // 클릭한 위치에 있는 모든 요소 찾기
        const elementsAtPoint = [];
        for (const element of elements) {
            if (this.isPointInElement(canvasX, canvasY, element)) {
                elementsAtPoint.push(element);
            }
        }
        
        if (elementsAtPoint.length === 0) {
        return null;
        }
        
        // name_box가 있으면 우선적으로 반환 (부모 요소와 겹칠 때 이름박스 선택 우선)
        const nameBox = elementsAtPoint.find(el => el.elementType === 'name_box');
        if (nameBox) {
            return nameBox;
        }
        
        // name_box가 없으면 z-index가 가장 높은 요소 반환 (첫 번째 요소)
        return elementsAtPoint[0];
    }
    
    /**
     * 점이 요소 안에 있는지 확인
     */
    isPointInElement(x, y, element) {
        // 선/점선의 경우 특별 처리 (선 근처를 클릭해야 선택됨)
        if (element.elementType === 'shape' && (element.shapeType === 'line' || element.shapeType === 'dashed-line')) {
            const startX = element.startX || element.xCoordinate;
            const startY = element.startY || element.yCoordinate;
            const endX = element.endX || (element.xCoordinate + (element.width || 100));
            const endY = element.endY || (element.yCoordinate + (element.height || 0));
            
            // 점과 선분 사이의 거리 계산
            const distance = this.pointToLineDistance(x, y, startX, startY, endX, endY);
            
            // 클릭 허용 범위 (선 두께 + 여유 공간)
            const threshold = ((element.borderWidth || 2) / 2) + (10 / this.core.state.zoom);
            
            return distance <= threshold;
        }
        
        // 일반 요소의 경우 사각형 영역 체크
        const ex = element.xCoordinate;
        const ey = element.yCoordinate;
        const ew = element.width || 100;
        const eh = element.height || 80;
        
        return x >= ex && x <= ex + ew && y >= ey && y <= ey + eh;
    }
    
    /**
     * 점과 선분 사이의 최단 거리 계산
     */
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        let param = -1;
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * 리사이즈 핸들 찾기
     * @returns {string|null} 핸들 위치 ('nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e') 또는 null
     */
    findResizeHandle(canvasX, canvasY, element) {
        if (!element) return null;
        
        const handleSize = 8 / this.core.state.zoom;  // 화면에서 8px
        
        // 현관, 계단의 경우 회전 핸들 확인 (회전 핸들은 더 크게)
        if (element.elementType === 'entrance' || element.elementType === 'stairs') {
            const ex = element.xCoordinate;
            const ey = element.yCoordinate;
            const ew = element.width || 100;
            const eh = element.height || 80;
            const handleDistance = 30 / this.core.state.zoom;
            const centerX = ex + ew / 2;
            const handleY = ey - handleDistance;
            const rotateHandleSize = 12 / this.core.state.zoom;  // 회전 핸들은 더 크게 (12px)
            
            // 회전 핸들 (상단 중앙)
            const distX = Math.abs(canvasX - centerX);
            const distY = Math.abs(canvasY - handleY);
            
            if (distX <= rotateHandleSize && distY <= rotateHandleSize) {
                console.debug('🔄 회전 핸들 감지:', {
                    elementType: element.elementType,
                    handlePos: { x: centerX.toFixed(0), y: handleY.toFixed(0) },
                    mousePos: { x: canvasX.toFixed(0), y: canvasY.toFixed(0) },
                    distance: { x: distX.toFixed(1), y: distY.toFixed(1) },
                    handleSize: rotateHandleSize.toFixed(1)
                });
                return 'rotate';
            }
        }
        
        // 선/점선의 경우 양끝 핸들만 확인
        if (element.elementType === 'shape' && (element.shapeType === 'line' || element.shapeType === 'dashed-line')) {
            const startX = element.startX || element.xCoordinate;
            const startY = element.startY || element.yCoordinate;
            const endX = element.endX || (element.xCoordinate + (element.width || 100));
            const endY = element.endY || (element.yCoordinate + (element.height || 0));
            
            // 시작점 핸들
            if (Math.abs(canvasX - startX) <= handleSize && 
                Math.abs(canvasY - startY) <= handleSize) {
                return 'line-start';
            }
            
            // 끝점 핸들
            if (Math.abs(canvasX - endX) <= handleSize && 
                Math.abs(canvasY - endY) <= handleSize) {
                return 'line-end';
            }
            
            return null;
        }
        
        // 일반 요소의 경우 8방향 핸들
        const ex = element.xCoordinate;
        const ey = element.yCoordinate;
        const ew = element.width || 100;
        const eh = element.height || 80;
        
        // 현관(entrance)의 경우 대각선 핸들만 허용 (정사각형 비율 유지)
        const isEntrance = element.elementType === 'entrance' || 
                          (element.elementType === 'shape' && element.shapeType === 'entrance');
        
        const handles = {
            'nw': { x: ex, y: ey },
            'ne': { x: ex + ew, y: ey },
            'sw': { x: ex, y: ey + eh },
            'se': { x: ex + ew, y: ey + eh }
        };
        
        // 현관이 아닌 경우에만 위/아래/좌우 핸들 추가
        if (!isEntrance) {
            handles['n'] = { x: ex + ew / 2, y: ey };
            handles['s'] = { x: ex + ew / 2, y: ey + eh };
            handles['w'] = { x: ex, y: ey + eh / 2 };
            handles['e'] = { x: ex + ew, y: ey + eh / 2 };
        }
        
        for (const [position, handle] of Object.entries(handles)) {
            if (Math.abs(canvasX - handle.x) <= handleSize && 
                Math.abs(canvasY - handle.y) <= handleSize) {
                return position;
            }
        }
        
        return null;
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
    
    // ===== 리사이즈 =====
    
    /**
     * 리사이즈 시작
     */
    startResize(x, y, element, handle) {
        // 잠긴 요소는 리사이즈 불가
        if (element.isLocked) {
            console.debug('🔒 잠긴 요소는 리사이즈 불가:', element.id);
            return;
        }
        
        // 회전 핸들의 경우 startRotate로 전환
        if (handle === 'rotate') {
            this.startRotate(x, y, element);
            return;
        }
        
        // 히스토리 저장 (작업 전 상태 저장)
        if (this.historyManager) {
            this.historyManager.saveState('작업 전');
        }
        
        this.state.isResizing = true;
        
        // Core 상태 업데이트: isResizing = true, hoveredElement = null (중요!)
        this.core.state.isResizing = true;  // 즉시 직접 설정
        this.core.state.hoveredElement = null;  // 즉시 직접 설정
        
        this.resizeStart.element = element;
        this.resizeStart.handle = handle;
        this.resizeStart.originalX = element.xCoordinate;
        this.resizeStart.originalY = element.yCoordinate;
        this.resizeStart.originalWidth = element.width;
        this.resizeStart.originalHeight = element.height;
        this.resizeStart.startX = x;
        this.resizeStart.startY = y;
        
        // 선/점선의 경우 시작점과 끝점 저장
        if (element.elementType === 'shape' && (element.shapeType === 'line' || element.shapeType === 'dashed-line')) {
            this.resizeStart.originalStartX = element.startX || element.xCoordinate;
            this.resizeStart.originalStartY = element.startY || element.yCoordinate;
            this.resizeStart.originalEndX = element.endX || (element.xCoordinate + (element.width || 100));
            this.resizeStart.originalEndY = element.endY || (element.yCoordinate + (element.height || 0));
        }
        
        this.canvas.style.cursor = this.getResizeCursor(handle);
        
        // 즉시 강제 렌더링 (선택 효과 제거를 즉시 반영)
        this.core.markDirty();
        this.core.render();  // 동기적으로 즉시 렌더링
        
        console.debug('📏 리사이즈 시작 + 즉시 렌더링:', handle, '| isResizing:', this.core.state.isResizing);
    }
    
    /**
     * 회전 시작
     */
    startRotate(x, y, element) {
        // 잠긴 요소는 회전 불가
        if (element.isLocked) {
            console.debug('🔒 잠긴 요소는 회전 불가:', element.id);
            return;
        }
        
        // 히스토리 저장
        if (this.historyManager) {
            this.historyManager.saveState('작업 전');
        }
        
        this.state.isRotating = true;
        
        // 요소의 중심 계산
        const centerX = element.xCoordinate + (element.width || 100) / 2;
        const centerY = element.yCoordinate + (element.height || 80) / 2;
        
        // 화면 좌표를 캔버스 좌표로 변환
        const canvasPos = this.core.screenToCanvas(x, y);
        
        // 시작 각도 계산 (중심에서 마우스까지)
        const startAngle = Math.atan2(
            canvasPos.y - centerY,
            canvasPos.x - centerX
        ) * (180 / Math.PI);
        
        this.rotateStart = {
            element: element,
            originalRotation: element.rotation || 0,
            centerX: centerX,
            centerY: centerY,
            startAngle: startAngle
        };
        
        // Core 상태 업데이트
        this.core.state.isRotating = true;
        this.core.state.hoveredElement = null;
        
        this.canvas.style.cursor = 'grabbing';
        
        this.core.markDirty();
        this.core.render();
        
        console.debug('🔄 회전 시작:', {
            element: element.id,
            originalRotation: this.rotateStart.originalRotation,
            startAngle: startAngle,
            center: { x: centerX, y: centerY }
        });
    }
    
    /**
     * 회전 업데이트
     */
    updateRotate(x, y) {
        const element = this.rotateStart.element;
        const centerX = this.rotateStart.centerX;
        const centerY = this.rotateStart.centerY;
        const startAngle = this.rotateStart.startAngle;
        const originalRotation = this.rotateStart.originalRotation;
        
        // 화면 좌표를 캔버스 좌표로 변환
        const canvasPos = this.core.screenToCanvas(x, y);
        
        // 중심에서 현재 마우스 위치까지의 각도 계산
        const currentAngle = Math.atan2(
            canvasPos.y - centerY,
            canvasPos.x - centerX
        ) * (180 / Math.PI);
        
        // 각도 차이 계산
        let angleDelta = currentAngle - startAngle;
        
        // 새 회전 각도 = 원래 회전 + 각도 변화
        let newRotation = originalRotation + angleDelta;
        
        // 0-360 범위로 정규화
        while (newRotation < 0) newRotation += 360;
        while (newRotation >= 360) newRotation -= 360;
        
        // 요소 회전 업데이트
        element.rotation = newRotation;
        
        this.core.markDirty();
        
        console.debug('🔄 회전 중:', {
            currentAngle: currentAngle.toFixed(1),
            angleDelta: angleDelta.toFixed(1),
            newRotation: newRotation.toFixed(1)
        });
    }
    
    /**
     * 회전 종료
     */
    endRotate() {
        const finalRotation = this.rotateStart?.element?.rotation || 0;
        
        this.state.isRotating = false;
        this.core.state.isRotating = false;
        this.rotateStart = null;
        this.canvas.style.cursor = 'default';
        
        this.core.markDirty();
        console.debug('🔄 회전 종료 - 최종 각도:', finalRotation.toFixed(1) + '°');
    }
    
    /**
     * 리사이즈 업데이트
     */
    updateResize(x, y) {
        const element = this.resizeStart.element;
        const handle = this.resizeStart.handle;
        
        // 화면 좌표 이동을 캔버스 좌표 이동으로 변환
        const dx_screen = x - this.resizeStart.startX;
        const dy_screen = y - this.resizeStart.startY;
        const dx_canvas = dx_screen / this.core.state.zoom;
        const dy_canvas = dy_screen / this.core.state.zoom;
        
        // 선/점선의 경우 특별 처리
        if (element.elementType === 'shape' && (element.shapeType === 'line' || element.shapeType === 'dashed-line')) {
            let newStartX = this.resizeStart.originalStartX;
            let newStartY = this.resizeStart.originalStartY;
            let newEndX = this.resizeStart.originalEndX;
            let newEndY = this.resizeStart.originalEndY;
            
            if (handle === 'line-start') {
                // 시작점 이동
                newStartX += dx_canvas;
                newStartY += dy_canvas;
            } else if (handle === 'line-end') {
                // 끝점 이동
                newEndX += dx_canvas;
                newEndY += dy_canvas;
            }
            
            // xCoordinate, yCoordinate, width, height 계산 (바운딩 박스)
            const minX = Math.min(newStartX, newEndX);
            const minY = Math.min(newStartY, newEndY);
            const maxX = Math.max(newStartX, newEndX);
            const maxY = Math.max(newStartY, newEndY);
            
            this.core.updateElement(element.id, {
                xCoordinate: minX,
                yCoordinate: minY,
                width: maxX - minX,
                height: maxY - minY,
                startX: newStartX,
                startY: newStartY,
                endX: newEndX,
                endY: newEndY
            });
            
            this.core.markDirty();
            return;
        }
        
        // 일반 요소의 경우 기존 로직
        let newX = this.resizeStart.originalX;
        let newY = this.resizeStart.originalY;
        let newWidth = this.resizeStart.originalWidth;
        let newHeight = this.resizeStart.originalHeight;
        
        // 현관(entrance)의 경우 대각선 핸들만 허용하고 정사각형 비율 유지
        const isEntrance = element.elementType === 'entrance' || 
                          (element.elementType === 'shape' && element.shapeType === 'entrance');
        
        // 핸들 위치에 따라 크기 조정
        switch (handle) {
            case 'nw':  // 북서 (좌상)
                if (isEntrance) {
                    // 현관: 대각선 변화량의 평균을 사용하여 정사각형 비율 유지
                    const avgDelta = (dx_canvas + dy_canvas) / 2;
                    newX = this.resizeStart.originalX + avgDelta;
                    newY = this.resizeStart.originalY + avgDelta;
                    newWidth = this.resizeStart.originalWidth - avgDelta;
                    newHeight = this.resizeStart.originalHeight - avgDelta;
                } else {
                    newX += dx_canvas;
                    newY += dy_canvas;
                    newWidth -= dx_canvas;
                    newHeight -= dy_canvas;
                }
                break;
            case 'ne':  // 북동 (우상)
                if (isEntrance) {
                    // 현관: 대각선 변화량의 평균을 사용하여 정사각형 비율 유지
                    const avgDelta = (-dx_canvas + dy_canvas) / 2;
                    newY = this.resizeStart.originalY + avgDelta;
                    newWidth = this.resizeStart.originalWidth - avgDelta;
                    newHeight = this.resizeStart.originalHeight - avgDelta;
                    newX = this.resizeStart.originalX; // X는 변경 없음
                } else {
                    newY += dy_canvas;
                    newWidth += dx_canvas;
                    newHeight -= dy_canvas;
                }
                break;
            case 'sw':  // 남서 (좌하)
                if (isEntrance) {
                    // 현관: 대각선 변화량의 평균을 사용하여 정사각형 비율 유지
                    const avgDelta = (dx_canvas - dy_canvas) / 2;
                    newX = this.resizeStart.originalX + avgDelta;
                    newWidth = this.resizeStart.originalWidth - avgDelta;
                    newHeight = this.resizeStart.originalHeight - avgDelta;
                    newY = this.resizeStart.originalY; // Y는 변경 없음
                } else {
                    newX += dx_canvas;
                    newWidth -= dx_canvas;
                    newHeight += dy_canvas;
                }
                break;
            case 'se':  // 남동 (우하)
                if (isEntrance) {
                    // 현관: 대각선 변화량의 평균을 사용하여 정사각형 비율 유지
                    const avgDelta = (dx_canvas + dy_canvas) / 2;
                    newWidth = this.resizeStart.originalWidth + avgDelta;
                    newHeight = this.resizeStart.originalHeight + avgDelta;
                    newX = this.resizeStart.originalX; // X는 변경 없음
                    newY = this.resizeStart.originalY; // Y는 변경 없음
                } else {
                    newWidth += dx_canvas;
                    newHeight += dy_canvas;
                }
                break;
            case 'n':   // 북 (상) - 현관은 비활성화
                if (!isEntrance) {
                    newY += dy_canvas;
                    newHeight -= dy_canvas;
                }
                break;
            case 's':   // 남 (하) - 현관은 비활성화
                if (!isEntrance) {
                    newHeight += dy_canvas;
                }
                break;
            case 'w':   // 서 (좌) - 현관은 비활성화
                if (!isEntrance) {
                    newX += dx_canvas;
                    newWidth -= dx_canvas;
                }
                break;
            case 'e':   // 동 (우) - 현관은 비활성화
                if (!isEntrance) {
                    newWidth += dx_canvas;
                }
                break;
        }
        
        // 최소 크기 제한
        const minWidth = 20;
        const minHeight = 20;
        
        if (newWidth < minWidth) {
            newWidth = minWidth;
            if (handle.includes('w')) {
                newX = this.resizeStart.originalX + this.resizeStart.originalWidth - minWidth;
            }
        }
        
        if (newHeight < minHeight) {
            newHeight = minHeight;
            if (handle.includes('n')) {
                newY = this.resizeStart.originalY + this.resizeStart.originalHeight - minHeight;
            }
        }
        
        // 이름박스의 경우 부모 요소 경계 내로 제한 (건물의 이름박스는 제외)
        if (element.elementType === 'name_box' && element.parentElementId) {
            const parent = this.core.state.elements.find(e => e.id === element.parentElementId);
            if (parent && parent.elementType !== 'building') {
                // 건물이 아닌 부모의 이름박스만 경계 제한
                // 부모의 경계
                const parentLeft = parent.xCoordinate;
                const parentTop = parent.yCoordinate;
                const parentRight = parent.xCoordinate + parent.width;
                const parentBottom = parent.yCoordinate + parent.height;
                
                // 위치 제한
                newX = Math.max(parentLeft, Math.min(newX, parentRight - newWidth));
                newY = Math.max(parentTop, Math.min(newY, parentBottom - newHeight));
                
                // 크기 제한 (부모를 벗어나지 않도록)
                const maxWidth = parentRight - newX;
                const maxHeight = parentBottom - newY;
                newWidth = Math.min(newWidth, maxWidth);
                newHeight = Math.min(newHeight, maxHeight);
            }
            // 건물의 이름박스는 경계 제한 없음 (캔버스 경계만 체크)
        }
        
        // 요소 업데이트
        const resizeUpdates = {
            xCoordinate: newX,
            yCoordinate: newY,
            width: newWidth,
            height: newHeight
        };
        
        if (element.elementType === 'wireless_ap') {
            const shapeType = element.shapeType || 'circle';
            if (shapeType === 'circle') {
                const size = Math.max(newWidth, newHeight);
                const centerX = newX + newWidth / 2;
                const centerY = newY + newHeight / 2;
                resizeUpdates.width = size;
                resizeUpdates.height = size;
                resizeUpdates.xCoordinate = centerX - size / 2;
                resizeUpdates.yCoordinate = centerY - size / 2;
                resizeUpdates.radius = size / 2;
            }
        }
        
        this.core.updateElement(element.id, resizeUpdates);
        
        this.core.markDirty();
    }
    
    /**
     * 리사이즈 종료
     */
    endResize() {
        console.debug('✅ 리사이즈 종료');
        
        this.state.isResizing = false;
        this.core.state.isResizing = false;  // 즉시 직접 설정
        this.resizeStart.element = null;
        this.resizeStart.handle = null;
        this.canvas.style.cursor = 'default';
        
        // 즉시 강제 렌더링 (선택 효과 다시 표시)
        this.core.markDirty();
        this.core.render();  // 동기적으로 즉시 렌더링
        
        // 리사이즈 종료 후 현재 마우스 위치에서 호버 업데이트 (회전 핸들 감지용)
        // 렌더링 완료 후 호버 업데이트 (요소 위치 업데이트 반영)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (this.lastMousePos) {
                    const canvasPos = this.core.screenToCanvas(this.lastMousePos.x, this.lastMousePos.y);
                    console.debug('🔄 리사이즈 종료 후 호버 업데이트:', {
                        mousePos: this.lastMousePos,
                        canvasPos: canvasPos,
                        selectedElement: this.core.state.selectedElements[0]?.id
                    });
                    this.updateHover(canvasPos.x, canvasPos.y);
                }
            });
        });
        
        console.debug('✅ 리사이즈 종료 + 즉시 렌더링 | isResizing:', this.core.state.isResizing);
    }
    
    /**
     * 리사이즈 커서 얻기
     */
    getResizeCursor(handle) {
        const cursors = {
            'nw': 'nw-resize',
            'ne': 'ne-resize',
            'sw': 'sw-resize',
            'se': 'se-resize',
            'n': 'n-resize',
            's': 's-resize',
            'w': 'w-resize',
            'e': 'e-resize',
            'line-start': 'move',
            'line-end': 'move',
            'rotate': 'grab'  // ✅ 회전 핸들 커서 추가
        };
        return cursors[handle] || 'default';
    }
    
    /**
     * 호버 업데이트 (커서 포함)
     */
    updateHover(canvasX, canvasY) {
        // 선택된 요소가 있으면 최신 상태로 가져오기 (드래그/리사이즈 후 위치 업데이트 반영)
        const selectedElementId = this.core.state.selectedElements[0]?.id;
        let selectedElement = null;
        if (selectedElementId) {
            // core.state.elements에서 최신 상태로 가져오기
            selectedElement = this.core.state.elements.find(e => e.id === selectedElementId);
        }
        
        // 선택된 요소의 리사이즈 핸들 위에 있는지 확인 (회전 핸들 포함)
        if (selectedElement) {
            const handle = this.findResizeHandle(canvasX, canvasY, selectedElement);
            if (handle) {
                console.debug('🎯 선택된 요소의 핸들 감지:', {
                    handle: handle,
                    elementId: selectedElement.id,
                    elementType: selectedElement.elementType,
                    canvasPos: { x: canvasX.toFixed(1), y: canvasY.toFixed(1) },
                    elementPos: {
                        x: selectedElement.xCoordinate.toFixed(1),
                        y: selectedElement.yCoordinate.toFixed(1),
                        w: selectedElement.width?.toFixed(1),
                        h: selectedElement.height?.toFixed(1)
                    }
                });
                this.canvas.style.cursor = this.getResizeCursor(handle);
                // 선택된 요소를 hoveredElement로 설정하여 핸들이 표시되도록 함
                if (this.core.state.hoveredElement !== selectedElement) {
                    this.core.setState({ hoveredElement: selectedElement });
                }
                return;
            }
        }
        
        // 호버된 요소 확인
        const hoveredElement = this.findElementAt(canvasX, canvasY);
        if (hoveredElement !== this.core.state.hoveredElement) {
            this.core.setState({ hoveredElement });
        }
        this.canvas.style.cursor = hoveredElement ? 'move' : 'default';
    }
    
    // ===== 정리 =====
    
    /**
     * 현재 모드 설정 (삭제 콜백용)
     */
    setCurrentMode(mode) {
        this.currentMode = mode;
    }
    
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

