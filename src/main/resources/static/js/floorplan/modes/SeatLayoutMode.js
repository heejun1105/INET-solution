/**
 * SeatLayoutMode.js
 * 자리배치 설계 모드 매니저
 * 
 * 책임:
 * - 교실 클릭 시 미니 캔버스 모달 표시
 * - 교실 내 자리 배치 (사각형)
 * - 장비를 자리에 드래그앤드롭으로 배치
 * - 텍스트 상자 추가
 * - 자리 배치 정보 저장
 */

import FloorPlanCore from '../core/FloorPlanCore.js';
import ElementManager from '../core/ElementManager.js';
import InteractionManager from '../core/InteractionManager.js';

export default class SeatLayoutMode {
    constructor(core, elementManager, uiManager) {
        this.core = core;
        this.elementManager = elementManager;
        this.uiManager = uiManager;
        
        this.currentClassroom = null;
        this.modalOpen = false;
        
        // 미니 캔버스 관련
        this.miniCore = null;
        this.miniElementManager = null;
        this.miniInteractionManager = null;
        
        // 자리 추가 모드
        this.seatPlacementMode = false;
        this.entrancePlacementMode = false;
        this.selectedDevice = null; // 선택된 장비
        this.isEditMode = false; // 수정 모드 상태
        
        // 마우스 다운 위치 저장 (클릭 감지용)
        this.miniCanvasMouseDownPos = null;
        
        // 저장된 레이아웃 데이터
        this.savedLayouts = {};
        
        console.log('🪑 SeatLayoutMode 초기화');
    }
    
    /**
     * 모드 활성화
     */
    activate() {
        console.log('✅ 자리배치설계 모드 활성화');
        this.lockRoomsAndBuildings();
        this.setupUI();
        this.bindEvents();
        
        const header = document.querySelector('.workspace-header');
        if (header) {
            header.classList.add('classroom-mode');
        }
        
        // 강제 렌더링
        this.core.markDirty();
    }
    
    /**
     * 모드 비활성화
     */
    deactivate() {
        console.log('❌ 자리배치설계 모드 비활성화');
        this.unlockRoomsAndBuildings();
        this.closeModal();
        this.unbindEvents();
        
        // 미니 캔버스 정리
        if (this.miniCore) {
            this.miniCore = null;
            this.miniElementManager = null;
            this.miniInteractionManager = null;
        }
        
        const header = document.querySelector('.workspace-header');
        if (header) {
            header.classList.remove('classroom-mode');
        }
    }
    
    /**
     * UI 설정
     */
    setupUI() {
        const toolbar = document.getElementById('design-toolbar');
        if (!toolbar) return;
        
        toolbar.innerHTML = `
            <div class="toolbar-section">
                <h3>자리배치 설계</h3>
                <p class="hint">교실을 클릭하여 자리를 배치하세요</p>
            </div>
        `;
    }
    
    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        this.canvasMouseDownHandler = (e) => this.handleCanvasMouseDown(e);
        this.canvasTouchStartHandler = (e) => this.handleCanvasTouchStart(e);
        
        const canvas = this.core.canvas;
        // Capture phase에서 먼저 처리하여 InteractionManager보다 우선 실행
        canvas.addEventListener('mousedown', this.canvasMouseDownHandler, true);
        canvas.addEventListener('touchstart', this.canvasTouchStartHandler, true);
    }
    
    /**
     * 이벤트 해제
     */
    unbindEvents() {
        const canvas = this.core.canvas;
        if (this.canvasMouseDownHandler) {
            canvas.removeEventListener('mousedown', this.canvasMouseDownHandler, true);
        }
        if (this.canvasTouchStartHandler) {
            canvas.removeEventListener('touchstart', this.canvasTouchStartHandler, true);
        }
    }
    
    /**
     * 캔버스 마우스 다운 처리 (데스크톱)
     */
    handleCanvasMouseDown(e) {
        // 우클릭은 무시
        if (e.button === 2) return;
        
        // 자리배치 설계 모드에서만 처리
        if (this.core.state.currentMode !== 'design-seat') return;
        
        // InteractionManager와 동일한 방식으로 좌표 계산
        const canvasPos = this.core.screenToCanvas(e.clientX, e.clientY);
        
        // 클릭된 요소 찾기
        const clickedElement = this.elementManager.getElementAtPosition(canvasPos.x, canvasPos.y);
        
        // 이름 박스인 경우 부모 요소 찾기
        let targetRoom = null;
        if (clickedElement && clickedElement.elementType === 'name_box') {
            if (clickedElement.parentElementId) {
                const parentElement = this.core.state.elements.find(
                    el => el.id === clickedElement.parentElementId
                );
                if (parentElement && parentElement.elementType === 'room') {
                    targetRoom = parentElement;
                }
            }
        } else if (clickedElement && clickedElement.elementType === 'room') {
            targetRoom = clickedElement;
        }
        
        // 교실 클릭 시 모달 열기
        if (targetRoom) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            this.openClassroomModal(targetRoom);
        }
    }
    
    /**
     * 캔버스 터치 시작 처리 (모바일/태블릿)
     */
    handleCanvasTouchStart(e) {
        // 자리배치 설계 모드에서만 처리
        if (this.core.state.currentMode !== 'design-seat') return;
        
        if (e.touches && e.touches.length === 1) {
            const touch = e.touches[0];
            // InteractionManager와 동일한 방식으로 좌표 계산
            const canvasPos = this.core.screenToCanvas(touch.clientX, touch.clientY);
            
            // 클릭된 요소 찾기
            const clickedElement = this.elementManager.getElementAtPosition(canvasPos.x, canvasPos.y);
            
            // 이름 박스인 경우 부모 요소 찾기
            let targetRoom = null;
            if (clickedElement && clickedElement.elementType === 'name_box') {
                if (clickedElement.parentElementId) {
                    const parentElement = this.core.state.elements.find(
                        el => el.id === clickedElement.parentElementId
                    );
                    if (parentElement && parentElement.elementType === 'room') {
                        targetRoom = parentElement;
                    }
                }
            } else if (clickedElement && clickedElement.elementType === 'room') {
                targetRoom = clickedElement;
            }
            
            // 교실 터치 시 모달 열기
            if (targetRoom) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();
                this.openClassroomModal(targetRoom);
            }
        }
    }
    
    /**
     * 교실 모달 열기
     */
    async openClassroomModal(roomElement) {
        this.currentClassroom = roomElement;
        this.modalOpen = true;
        
        // 모달 생성
        let modal = document.getElementById('seat-layout-modal');
        if (!modal) {
            this.createModal();
            modal = document.getElementById('seat-layout-modal');
        }
        
        // 교실 정보 표시
        const title = modal.querySelector('#seat-modal-title');
        if (title) {
            title.textContent = `자리 배치 - ${roomElement.label || roomElement.id}`;
        }
        
        // 교실 장비 로드
        await this.loadClassroomDevices(roomElement.referenceId || roomElement.classroomId);
        
        // 저장된 레이아웃 로드
        await this.loadSavedLayout(roomElement.referenceId || roomElement.classroomId);
        
        // 미니 캔버스 초기화
        this.initMiniCanvas();
        
        // 모달 표시
        modal.style.display = 'flex';
        
        console.log('📖 교실 모달 열기:', roomElement);
    }
    
    /**
     * 모달 생성
     */
    createModal() {
        const modal = document.createElement('div');
        modal.id = 'seat-layout-modal';
        modal.className = 'seat-layout-modal-overlay';
        modal.innerHTML = `
            <div class="seat-layout-modal-content">
                <div class="seat-modal-header">
                    <h2 id="seat-modal-title">교실 자리 배치</h2>
                    <div class="seat-modal-header-actions">
                        <button id="edit-mode-btn" class="edit-mode-btn" title="수정 모드">
                            <i class="fas fa-edit"></i> 수정 모드
                        </button>
                        <button id="save-seat-layout-btn" class="save-btn" title="저장">
                            <i class="fas fa-save"></i> 저장
                        </button>
                        <button id="close-seat-modal" class="close-btn" title="닫기">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="seat-modal-body">
                    <div class="seat-modal-sidebar">
                        <div class="sidebar-header">
                            <h3>미배치 장비목록</h3>
                            <div class="sidebar-tool-buttons">
                                <button id="add-seat-btn" class="tool-btn-small" title="자리 추가">
                                    <i class="fas fa-square"></i>
                                    <span>자리 추가</span>
                                </button>
                                <button id="add-entrance-btn" class="tool-btn-small" title="입구 추가">
                                    <i class="fas fa-door-open"></i>
                                    <span>입구 추가</span>
                                </button>
                            </div>
                        </div>
                        <div id="device-cards-container" class="device-cards-container">
                            <p class="loading">로딩 중...</p>
                        </div>
                    </div>
                    <div class="seat-modal-canvas-container">
                        <div id="mini-canvas-wrapper" class="mini-canvas-wrapper">
                            <!-- 미니 캔버스가 여기에 생성됨 -->
                        </div>
                        <div class="mini-canvas-controls">
                            <button id="mini-zoom-in" class="mini-zoom-btn" title="확대">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button id="mini-zoom-out" class="mini-zoom-btn" title="축소">
                                <i class="fas fa-minus"></i>
                            </button>
                            <span id="mini-zoom-display" class="mini-zoom-display">100%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 이벤트 바인딩
        document.getElementById('close-seat-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('save-seat-layout-btn').addEventListener('click', () => this.saveSeatLayout());
        document.getElementById('edit-mode-btn').addEventListener('click', () => this.toggleEditMode());
        document.getElementById('add-seat-btn').addEventListener('click', () => this.enableSeatPlacementMode());
        document.getElementById('add-entrance-btn').addEventListener('click', () => this.enableEntrancePlacementMode());
        
        // 줌 컨트롤
        document.getElementById('mini-zoom-in').addEventListener('click', () => this.miniZoomIn());
        document.getElementById('mini-zoom-out').addEventListener('click', () => this.miniZoomOut());
    }
    
    /**
     * 미니 캔버스 초기화
     */
    initMiniCanvas() {
        const wrapper = document.getElementById('mini-canvas-wrapper');
        if (!wrapper) return;
        
        // 기존 캔버스 제거
        wrapper.innerHTML = '';
        
        // 미니 캔버스 컨테이너 생성 (고정 크기 제거, CSS가 자동으로 조정)
        const container = document.createElement('div');
        container.className = 'mini-canvas-container';
        wrapper.appendChild(container);
        
        // 컨테이너가 렌더링될 때까지 대기
        setTimeout(() => {
            // 미니 캔버스 Core 초기화 (3배 크기로 설정하여 더 많이 축소 가능하도록)
            this.miniCore = new FloorPlanCore(container, {
                canvasWidth: 7200,
                canvasHeight: 5400,
                zoom: 1.0,
                gridSize: 20,
                showGrid: true,
                snapToGrid: false
            });
            
            this.miniElementManager = new ElementManager(this.miniCore);
            this.miniInteractionManager = new InteractionManager(this.miniCore, this.miniElementManager);
            
            // 캔버스 리사이즈 (컨테이너 크기에 맞춤)
            this.miniCore.resize();
            
            // 미니 캔버스 이벤트 바인딩
            this.bindMiniCanvasEvents();
            
            // 저장된 레이아웃 렌더링
            this.renderSavedLayout();
            
            // 캔버스 중앙 정렬 및 요소에 맞게 조정
            this.fitMiniCanvasToElements();
            
            // 리사이즈 옵저버 추가 (컨테이너 크기 변경 감지)
            const resizeObserver = new ResizeObserver(() => {
                if (this.miniCore && container.getBoundingClientRect().width > 0) {
                    this.miniCore.resize();
                    this.fitMiniCanvasToElements();
                }
            });
            resizeObserver.observe(container);
            this._miniCanvasResizeObserver = resizeObserver;
            
            console.log('✅ 미니 캔버스 초기화 완료');
        }, 50);
    }
    
    /**
     * 미니 캔버스 이벤트 바인딩
     */
    bindMiniCanvasEvents() {
        if (!this.miniCore || !this.miniCore.canvas) return;
        
        const canvas = this.miniCore.canvas;
        
        // InteractionManager가 이미 이벤트를 처리하므로, 
        // 자리 배치/장비 배치 모드일 때만 추가 처리를 위해 
        // 마우스 업 이벤트에서 클릭을 감지 (드래그/팬이 발생하지 않은 경우만)
        this.miniCanvasMouseUpHandler = (e) => {
            // 수정 모드일 때 장비 요소 클릭 처리
            if (this.isEditMode) {
                // 팬/드래그/리사이즈 중이 아닐 때만 처리
                if (this.miniInteractionManager && (
                    this.miniInteractionManager.state.isPanning ||
                    this.miniInteractionManager.state.isDragging ||
                    this.miniInteractionManager.state.isResizing ||
                    this.miniInteractionManager.state.isSelecting
                )) {
                    return;
                }
                
                // 실제 클릭인지 확인
                if (this.miniCanvasMouseDownPos) {
                    const dx = e.clientX - this.miniCanvasMouseDownPos.x;
                    const dy = e.clientY - this.miniCanvasMouseDownPos.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // 5px 이내 이동이면 클릭으로 간주
                    if (distance <= 5) {
                        const canvasPos = this.miniCore.screenToCanvas(e.clientX, e.clientY);
                        const clickedElement = this.miniElementManager.getElementAtPosition(canvasPos.x, canvasPos.y);
                        
                        // 장비 요소인 경우 수정 페이지로 이동
                        if (clickedElement && clickedElement.elementType === 'device' && clickedElement.deviceId) {
                            e.stopPropagation();
                            e.preventDefault();
                            window.location.href = `/device/modify/${clickedElement.deviceId}`;
                            return;
                        }
                    }
                }
            }
            
            // 자리 배치 모드, 입구 배치 모드, 또는 장비 선택 모드일 때만 처리
            if (!this.seatPlacementMode && !this.entrancePlacementMode && !this.selectedDevice) {
                return;
            }
            
            // 팬/드래그/리사이즈 중이 아닐 때만 처리
            if (this.miniInteractionManager && (
                this.miniInteractionManager.state.isPanning ||
                this.miniInteractionManager.state.isDragging ||
                this.miniInteractionManager.state.isResizing ||
                this.miniInteractionManager.state.isSelecting
            )) {
                console.log('⚠️ InteractionManager가 처리 중이므로 클릭 무시');
                return; // InteractionManager가 처리 중이면 무시
            }
            
            // 실제 클릭인지 확인 (마우스 다운 위치와 업 위치가 거의 같아야 함)
            if (this.miniCanvasMouseDownPos) {
                const dx = e.clientX - this.miniCanvasMouseDownPos.x;
                const dy = e.clientY - this.miniCanvasMouseDownPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                console.log('🖱️ 미니 캔버스 마우스 업:', {
                    distance,
                    seatPlacementMode: this.seatPlacementMode,
                    selectedDevice: this.selectedDevice,
                    isPanning: this.miniInteractionManager?.state.isPanning,
                    isDragging: this.miniInteractionManager?.state.isDragging
                });
                
                // 5px 이내 이동이면 클릭으로 간주
                if (distance <= 5) {
                    if (this.seatPlacementMode) {
                        const canvasPos = this.miniCore.screenToCanvas(e.clientX, e.clientY);
                        console.log('✅ 자리 생성:', canvasPos);
                        this.createSeat(canvasPos.x, canvasPos.y);
                        this.seatPlacementMode = false;
                        // 버튼 상태 업데이트
                        const btn = document.getElementById('add-seat-btn');
                        if (btn) btn.classList.remove('active');
                        if (this.miniCore && this.miniCore.canvas) {
                            this.miniCore.canvas.style.cursor = 'default';
                        }
                        // 이벤트 전파 중단
                        e.stopPropagation();
                        e.preventDefault();
                    } else if (this.entrancePlacementMode) {
                        const canvasPos = this.miniCore.screenToCanvas(e.clientX, e.clientY);
                        console.log('✅ 입구 생성:', canvasPos);
                        this.createEntrance(canvasPos.x, canvasPos.y);
                        this.entrancePlacementMode = false;
                        // 버튼 상태 업데이트
                        const btn = document.getElementById('add-entrance-btn');
                        if (btn) btn.classList.remove('active');
                        if (this.miniCore && this.miniCore.canvas) {
                            this.miniCore.canvas.style.cursor = 'default';
                        }
                        // 이벤트 전파 중단
                        e.stopPropagation();
                        e.preventDefault();
                    } else if (this.selectedDevice) {
                        // 선택된 장비가 있으면 배치
                        const canvasPos = this.miniCore.screenToCanvas(e.clientX, e.clientY);
                        console.log('✅ 장비 배치:', canvasPos, this.selectedDevice);
                        this.placeDevice(canvasPos.x, canvasPos.y, this.selectedDevice.deviceId, this.selectedDevice.deviceData);
                        this.selectedDevice = null;
                        // 선택 해제
                        document.querySelectorAll('.device-card').forEach(card => {
                            card.classList.remove('selected');
                        });
                        if (this.miniCore && this.miniCore.canvas) {
                            this.miniCore.canvas.style.cursor = 'default';
                        }
                        // 이벤트 전파 중단
                        e.stopPropagation();
                        e.preventDefault();
                    }
                }
                
                this.miniCanvasMouseDownPos = null;
            }
        };
        
        this.miniCanvasMouseDownHandler = (e) => {
            // 수정 모드일 때 장비 요소 클릭 처리 (가장 먼저 처리)
            if (this.isEditMode && e.button === 0) { // 좌클릭만
                const canvasPos = this.miniCore.screenToCanvas(e.clientX, e.clientY);
                const clickedElement = this.miniElementManager.getElementAtPosition(canvasPos.x, canvasPos.y);
                
                // 장비 요소인 경우 수정 페이지로 이동하고 이벤트 전파 중단
                if (clickedElement && clickedElement.elementType === 'device' && clickedElement.deviceId) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    window.location.href = `/device/modify/${clickedElement.deviceId}`;
                    return;
                }
            }
            
            // 수정 모드일 때도 마우스 다운 위치 저장
            if (this.isEditMode) {
                this.miniCanvasMouseDownPos = {
                    x: e.clientX,
                    y: e.clientY
                };
            }
            
            // 자리 배치 모드, 입구 배치 모드, 또는 장비 선택 모드일 때만 처리
            if (this.seatPlacementMode || this.entrancePlacementMode || this.selectedDevice) {
                // 마우스 다운 위치 저장
                this.miniCanvasMouseDownPos = {
                    x: e.clientX,
                    y: e.clientY
                };
                console.log('🖱️ 미니 캔버스 마우스 다운:', {
                    pos: this.miniCanvasMouseDownPos,
                    seatPlacementMode: this.seatPlacementMode,
                    selectedDevice: this.selectedDevice
                });
                
                // InteractionManager가 처리하지 않도록 이벤트 전파 및 기본 동작 중단
                e.stopPropagation();
                e.preventDefault();
                
                // InteractionManager의 상태를 확인하고 초기화
                if (this.miniInteractionManager) {
                    // 선택 해제
                    if (this.miniCore.state.selectedElements && this.miniCore.state.selectedElements.length > 0) {
                        this.miniCore.setState({ selectedElements: [] });
                    }
                    // 팬/드래그 상태 확인 및 리셋
                    if (this.miniInteractionManager.state.isPanning) {
                        this.miniInteractionManager.endPan();
                    }
                    if (this.miniInteractionManager.state.isDragging) {
                        this.miniInteractionManager.endDrag();
                    }
                    if (this.miniInteractionManager.state.isSelecting) {
                        this.miniInteractionManager.endSelectionBox();
                    }
                }
            }
        };
        
        // 수정 모드일 때 장비 요소 클릭을 먼저 처리하기 위한 핸들러
        this.miniCanvasClickHandler = (e) => {
            if (!this.isEditMode) return;
            
            // 팬/드래그/리사이즈 중이 아닐 때만 처리
            if (this.miniInteractionManager && (
                this.miniInteractionManager.state.isPanning ||
                this.miniInteractionManager.state.isDragging ||
                this.miniInteractionManager.state.isResizing ||
                this.miniInteractionManager.state.isSelecting
            )) {
                return;
            }
            
            const canvasPos = this.miniCore.screenToCanvas(e.clientX, e.clientY);
            const clickedElement = this.miniElementManager.getElementAtPosition(canvasPos.x, canvasPos.y);
            
            // 장비 요소인 경우 수정 페이지로 이동하고 이벤트 전파 중단
            if (clickedElement && clickedElement.elementType === 'device' && clickedElement.deviceId) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();
                window.location.href = `/device/modify/${clickedElement.deviceId}`;
                return;
            }
        };
        
        // 마우스 이벤트 등록 (capture phase에서 먼저 처리)
        canvas.addEventListener('mousedown', this.miniCanvasMouseDownHandler, true);
        canvas.addEventListener('mouseup', this.miniCanvasMouseUpHandler, true);
        // 수정 모드일 때 클릭 이벤트를 먼저 처리 (capture phase)
        canvas.addEventListener('click', this.miniCanvasClickHandler, true);
        
        // 터치 이벤트도 처리 (모바일/태블릿)
        this.miniCanvasTouchStartHandler = (e) => {
            // 수정 모드일 때 장비 요소 클릭 처리 (가장 먼저 처리)
            if (this.isEditMode && e.touches && e.touches.length === 1) {
                const touch = e.touches[0];
                const canvasPos = this.miniCore.screenToCanvas(touch.clientX, touch.clientY);
                const clickedElement = this.miniElementManager.getElementAtPosition(canvasPos.x, canvasPos.y);
                
                // 장비 요소인 경우 수정 페이지로 이동하고 이벤트 전파 중단
                if (clickedElement && clickedElement.elementType === 'device' && clickedElement.deviceId) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    window.location.href = `/device/modify/${clickedElement.deviceId}`;
                    return;
                }
                
                // 마우스 다운 위치 저장
                this.miniCanvasMouseDownPos = {
                    x: touch.clientX,
                    y: touch.clientY
                };
                e.stopPropagation();
                e.preventDefault();
            }
            
            // 자리 배치 모드, 입구 배치 모드, 또는 장비 선택 모드일 때만 처리
            if (this.seatPlacementMode || this.entrancePlacementMode || this.selectedDevice) {
                if (e.touches && e.touches.length === 1) {
                    const touch = e.touches[0];
                    this.miniCanvasMouseDownPos = {
                        x: touch.clientX,
                        y: touch.clientY
                    };
                    console.log('📱 미니 캔버스 터치 시작:', this.miniCanvasMouseDownPos);
                    // InteractionManager가 처리하지 않도록
                    e.stopPropagation();
                    e.preventDefault();
                }
            }
        };
        
        this.miniCanvasTouchEndHandler = (e) => {
            // 수정 모드일 때 장비 요소 클릭 처리
            if (this.isEditMode) {
                // 팬/드래그/리사이즈 중이 아닐 때만 처리
                if (this.miniInteractionManager && (
                    this.miniInteractionManager.state.isPanning ||
                    this.miniInteractionManager.state.isDragging ||
                    this.miniInteractionManager.state.isResizing ||
                    this.miniInteractionManager.state.isSelecting
                )) {
                    return;
                }
                
                const touch = e.changedTouches && e.changedTouches.length > 0 
                    ? e.changedTouches[0] 
                    : null;
                
                if (touch && this.miniCanvasMouseDownPos) {
                    const dx = touch.clientX - this.miniCanvasMouseDownPos.x;
                    const dy = touch.clientY - this.miniCanvasMouseDownPos.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // 5px 이내 이동이면 클릭으로 간주
                    if (distance <= 5) {
                        const canvasPos = this.miniCore.screenToCanvas(touch.clientX, touch.clientY);
                        const clickedElement = this.miniElementManager.getElementAtPosition(canvasPos.x, canvasPos.y);
                        
                        // 장비 요소인 경우 수정 페이지로 이동
                        if (clickedElement && clickedElement.elementType === 'device' && clickedElement.deviceId) {
                            e.stopPropagation();
                            e.preventDefault();
                            window.location.href = `/device/modify/${clickedElement.deviceId}`;
                            return;
                        }
                    }
                }
            }
            
            // 자리 배치 모드, 입구 배치 모드, 또는 장비 선택 모드일 때만 처리
            if (!this.seatPlacementMode && !this.entrancePlacementMode && !this.selectedDevice) {
                return;
            }
            
            // 팬/드래그 중이 아닐 때만 처리
            if (this.miniInteractionManager && (
                this.miniInteractionManager.state.isPanning ||
                this.miniInteractionManager.state.isDragging ||
                this.miniInteractionManager.state.isResizing
            )) {
                return;
            }
            
            const touch = e.changedTouches && e.changedTouches.length > 0 
                ? e.changedTouches[0] 
                : null;
            
            if (touch && this.miniCanvasMouseDownPos) {
                const dx = touch.clientX - this.miniCanvasMouseDownPos.x;
                const dy = touch.clientY - this.miniCanvasMouseDownPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                console.log('📱 미니 캔버스 터치 끝:', {
                    distance,
                    seatPlacementMode: this.seatPlacementMode,
                    selectedDevice: this.selectedDevice
                });
                
                // 6px 이내 이동이면 클릭으로 간주
                if (distance <= 6) {
                    if (this.seatPlacementMode) {
                        const canvasPos = this.miniCore.screenToCanvas(touch.clientX, touch.clientY);
                        console.log('✅ 자리 생성 (터치):', canvasPos);
                        this.createSeat(canvasPos.x, canvasPos.y);
                        this.seatPlacementMode = false;
                        const btn = document.getElementById('add-seat-btn');
                        if (btn) btn.classList.remove('active');
                        if (this.miniCore && this.miniCore.canvas) {
                            this.miniCore.canvas.style.cursor = 'default';
                        }
                        e.stopPropagation();
                        e.preventDefault();
                    } else if (this.entrancePlacementMode) {
                        const canvasPos = this.miniCore.screenToCanvas(touch.clientX, touch.clientY);
                        console.log('✅ 입구 생성 (터치):', canvasPos);
                        this.createEntrance(canvasPos.x, canvasPos.y);
                        this.entrancePlacementMode = false;
                        const btn = document.getElementById('add-entrance-btn');
                        if (btn) btn.classList.remove('active');
                        if (this.miniCore && this.miniCore.canvas) {
                            this.miniCore.canvas.style.cursor = 'default';
                        }
                        e.stopPropagation();
                        e.preventDefault();
                    } else if (this.selectedDevice) {
                        const canvasPos = this.miniCore.screenToCanvas(touch.clientX, touch.clientY);
                        console.log('✅ 장비 배치 (터치):', canvasPos, this.selectedDevice);
                        this.placeDevice(canvasPos.x, canvasPos.y, this.selectedDevice.deviceId, this.selectedDevice.deviceData);
                        this.selectedDevice = null;
                        document.querySelectorAll('.device-card').forEach(card => {
                            card.classList.remove('selected');
                        });
                        if (this.miniCore && this.miniCore.canvas) {
                            this.miniCore.canvas.style.cursor = 'default';
                        }
                        e.stopPropagation();
                        e.preventDefault();
                    }
                }
                
                this.miniCanvasMouseDownPos = null;
            }
        };
        
        canvas.addEventListener('touchstart', this.miniCanvasTouchStartHandler, { passive: false });
        canvas.addEventListener('touchend', this.miniCanvasTouchEndHandler, { passive: false });
        
        // 줌 디스플레이 업데이트를 위한 휠 이벤트 리스너
        this.miniCanvasWheelHandler = () => {
            this.updateMiniZoomDisplay();
        };
        canvas.addEventListener('wheel', this.miniCanvasWheelHandler);
    }
    
    /**
     * 교실 장비 로드
     */
    async loadClassroomDevices(classroomId) {
        try {
            const schoolId = this.core.currentSchoolId;
            const response = await fetch(`/floorplan/api/schools/${schoolId}/classroom/${classroomId}/devices`);
            const result = await response.json();
            
            if (result.success) {
                this.devices = result.devices || [];
                this.renderDeviceCards(this.devices);
            } else {
                this.devices = [];
                this.renderDeviceCards([]);
            }
        } catch (error) {
            console.error('장비 로드 오류:', error);
            this.devices = [];
            this.renderDeviceCards([]);
        }
    }
    
    /**
     * 장비 카드 렌더링
     */
    renderDeviceCards(devices) {
        const container = document.getElementById('device-cards-container');
        if (!container) return;
        
        if (devices.length === 0) {
            container.innerHTML = '<p class="empty">미배치된 장비가 없습니다</p>';
            return;
        }
        
        container.innerHTML = devices.map(device => `
            <div class="device-card" 
                 draggable="true" 
                 data-device-id="${device.deviceId}"
                 data-device-data='${JSON.stringify(device)}'>
                <div class="device-card-header">
                    <span class="device-type">${device.type || '장비'}</span>
                </div>
                <div class="device-card-body">
                    <div class="device-info-row">
                        <span class="info-label">고유번호:</span>
                        <span class="info-value">${device.uidNumber || '-'}</span>
                    </div>
                    <div class="device-info-row">
                        <span class="info-label">관리번호:</span>
                        <span class="info-value">${device.manageNumber || '-'}</span>
                    </div>
                    <div class="device-info-row">
                        <span class="info-label">관리자:</span>
                        <span class="info-value">${device.operatorName || '-'}</span>
                    </div>
                    <div class="device-info-row">
                        <span class="info-label">세트번호:</span>
                        <span class="info-value">${device.setType || '-'}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        // 드래그 이벤트 설정
        this.setupDeviceDragEvents();
    }
    
    /**
     * 장비 클릭 이벤트 설정 (드래그 앤 드롭 대신 클릭 선택)
     */
    setupDeviceDragEvents() {
        document.querySelectorAll('.device-card').forEach(card => {
            // 드래그 기능 제거
            card.removeAttribute('draggable');
            
            // 클릭 이벤트로 변경
            card.addEventListener('click', (e) => {
                // 수정 모드일 때는 장비 수정 페이지로 이동
                if (this.isEditMode) {
                    e.stopPropagation();
                    const deviceId = card.dataset.deviceId;
                    if (deviceId) {
                        window.location.href = `/device/modify/${deviceId}`;
                    }
                    return;
                }
                
                // 기존 선택 해제
                document.querySelectorAll('.device-card').forEach(c => {
                    c.classList.remove('selected');
                });
                
                // 현재 카드 선택
                card.classList.add('selected');
                
                // 장비 정보 저장
                const deviceId = card.dataset.deviceId;
                const deviceData = card.dataset.deviceData ? JSON.parse(card.dataset.deviceData) : null;
                this.selectedDevice = {
                    deviceId: deviceId,
                    deviceData: deviceData
                };
                
                // 다른 모드 해제
                this.seatPlacementMode = false;
                
                // 버튼 상태 업데이트
                const seatBtn = document.getElementById('add-seat-btn');
                if (seatBtn) seatBtn.classList.remove('active');
                
                // 캔버스 커서 변경
                if (this.miniCore && this.miniCore.canvas) {
                    this.miniCore.canvas.style.cursor = 'crosshair';
                }
                
                this.uiManager.showNotification('캔버스를 클릭하여 장비를 배치하세요', 'info');
            });
        });
    }
    
    /**
     * 자리 추가 모드 활성화
     */
    enableSeatPlacementMode() {
        this.seatPlacementMode = true;
        this.entrancePlacementMode = false;
        this.selectedDevice = null;
        
        // 장비 카드 선택 해제
        document.querySelectorAll('.device-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // 버튼 상태 업데이트
        const seatBtn = document.getElementById('add-seat-btn');
        if (seatBtn) seatBtn.classList.add('active');
        const entranceBtn = document.getElementById('add-entrance-btn');
        if (entranceBtn) entranceBtn.classList.remove('active');
        
        if (this.miniCore && this.miniCore.canvas) {
            this.miniCore.canvas.style.cursor = 'crosshair';
        }
        
        this.uiManager.showNotification('미니 캔버스를 클릭하여 자리를 배치하세요', 'info');
    }
    
    /**
     * 입구 추가 모드 활성화
     */
    enableEntrancePlacementMode() {
        this.entrancePlacementMode = true;
        this.seatPlacementMode = false;
        this.selectedDevice = null;
        
        // 장비 카드 선택 해제
        document.querySelectorAll('.device-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // 버튼 상태 업데이트
        const entranceBtn = document.getElementById('add-entrance-btn');
        if (entranceBtn) entranceBtn.classList.add('active');
        const seatBtn = document.getElementById('add-seat-btn');
        if (seatBtn) seatBtn.classList.remove('active');
        
        if (this.miniCore && this.miniCore.canvas) {
            this.miniCore.canvas.style.cursor = 'crosshair';
        }
        
        this.uiManager.showNotification('미니 캔버스를 클릭하여 입구를 배치하세요', 'info');
    }
    
    /**
     * 수정 모드 토글
     */
    toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        const editBtn = document.getElementById('edit-mode-btn');
        
        if (this.isEditMode) {
            editBtn.classList.add('active');
            editBtn.innerHTML = '<i class="fas fa-check"></i> 수정 모드 ON';
            this.uiManager.showNotification('수정 모드가 활성화되었습니다. 장비 카드를 클릭하면 수정 페이지로 이동합니다.', 'info');
            
            // 다른 모드 해제
            this.seatPlacementMode = false;
            this.entrancePlacementMode = false;
            this.selectedDevice = null;
            
            // 버튼 상태 업데이트
            const seatBtn = document.getElementById('add-seat-btn');
            if (seatBtn) seatBtn.classList.remove('active');
            const entranceBtn = document.getElementById('add-entrance-btn');
            if (entranceBtn) entranceBtn.classList.remove('active');
            
            // 장비 카드 선택 해제
            document.querySelectorAll('.device-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            // 캔버스 커서 변경
            if (this.miniCore && this.miniCore.canvas) {
                this.miniCore.canvas.style.cursor = 'pointer';
            }
        } else {
            editBtn.classList.remove('active');
            editBtn.innerHTML = '<i class="fas fa-edit"></i> 수정 모드';
            this.uiManager.showNotification('수정 모드가 비활성화되었습니다.', 'info');
            
            // 캔버스 커서 복원
            if (this.miniCore && this.miniCore.canvas) {
                this.miniCore.canvas.style.cursor = 'default';
            }
        }
    }
    
    /**
     * 자리 생성 (500x250px 사각형) - 이름박스 포함
     */
    createSeat(x, y) {
        const name = prompt('자리 이름을 입력하세요:', '새자리');
        if (!name) return;
        
        const seatWidth = 500;
        const seatHeight = 250;
        
        // 중앙 정렬
        const seatX = x - seatWidth / 2;
        const seatY = y - seatHeight / 2;
        
        const seatElement = {
            type: 'seat',
            elementType: 'seat',
            xCoordinate: seatX,
            yCoordinate: seatY,
            width: seatWidth,
            height: seatHeight,
            label: name,
            borderColor: '#3b82f6',
            backgroundColor: '#dbeafe',
            borderWidth: 2,
            zIndex: 1 // 장비보다 낮음
        };
        
        const seat = this.miniElementManager.createElement('seat', seatElement);
        
        // 이름박스 자동 생성 (자리 상단 중앙)
        const nameBoxWidth = 160;
        const nameBoxHeight = 40;
        this.miniElementManager.createElement('name_box', {
            xCoordinate: seatX + (seatWidth - nameBoxWidth) / 2,  // 중앙 정렬
            yCoordinate: seatY + 25,  // 상단에서 25px 아래
            width: nameBoxWidth,
            height: nameBoxHeight,
            label: name,
            backgroundColor: '#ffffff',
            borderColor: '#000000',
            borderWidth: 2,
            fontSize: 18,
            parentElementId: seat.id,
            zIndex: 1 // 자리와 동일한 레이어
        });
        
        this.miniCore.markDirty();
        this.miniCore.render();
        
        // 요소 배치 시 자동 화면 이동 제거 (저장된 레이아웃 로드 시에만 작동)
        
        console.log('✅ 자리 생성:', seatElement);
    }
    
    /**
     * 입구 생성 (사각형, 중앙에 "입구" 텍스트)
     */
    createEntrance(x, y) {
        const entranceWidth = 200;
        const entranceHeight = 150;
        
        // 중앙 정렬
        const entranceX = x - entranceWidth / 2;
        const entranceY = y - entranceHeight / 2;
        
        const entranceElement = {
            type: 'entrance',
            elementType: 'entrance',
            xCoordinate: entranceX,
            yCoordinate: entranceY,
            width: entranceWidth,
            height: entranceHeight,
            label: '입구',
            borderColor: '#3b82f6',
            backgroundColor: '#dbeafe',
            borderWidth: 2,
            zIndex: 1
        };
        
        this.miniElementManager.createElement('entrance', entranceElement);
        
        this.miniCore.markDirty();
        this.miniCore.render();
        
        // 요소 배치 시 자동 화면 이동 제거 (저장된 레이아웃 로드 시에만 작동)
        
        console.log('✅ 입구 생성:', entranceElement);
    }
    
    /**
     * 장비 배치 (드래그 앤 드롭)
     */
    placeDevice(x, y, deviceId, deviceData) {
        const deviceWidth = 150;
        const deviceHeight = 100;
        
        // 중앙 정렬
        const deviceX = x - deviceWidth / 2;
        const deviceY = y - deviceHeight / 2;
        
        const deviceElement = {
            type: 'device',
            elementType: 'device',
            xCoordinate: deviceX,
            yCoordinate: deviceY,
            width: deviceWidth,
            height: deviceHeight,
            borderColor: '#000000',
            backgroundColor: '#f3f4f6',
            borderWidth: 2,
            deviceId: deviceId,
            deviceData: deviceData,
            zIndex: 3 // 가장 높음
        };
        
        this.miniElementManager.createElement('device', deviceElement);
        this.miniCore.markDirty();
        this.miniCore.render();
        
        // 배치된 장비를 목록에서 제거
        this.removeDeviceFromList(deviceId);
        
        // 요소 배치 시 자동 화면 이동 제거 (저장된 레이아웃 로드 시에만 작동)
        
        console.log('✅ 장비 배치:', deviceElement);
    }
    
    /**
     * 장비 목록에서 제거
     */
    removeDeviceFromList(deviceId) {
        // 장비 목록에서 해당 장비 제거
        const targetId = String(deviceId);
        this.devices = this.devices.filter(device => String(device.deviceId) !== targetId);
        
        // 장비 카드 DOM에서도 제거
        const card = document.querySelector(`[data-device-id="${targetId}"]`);
        if (card) {
            card.remove();
        }
        
        // 목록이 비어있으면 메시지 표시
        const container = document.getElementById('device-cards-container');
        if (container && this.devices.length === 0) {
            container.innerHTML = '<p class="empty">미배치된 장비가 없습니다</p>';
        }
    }
    
    /**
     * 미니 캔버스 줌 인
     */
    miniZoomIn() {
        if (!this.miniCore) return;
        this.miniCore.zoomIn();
        this.updateMiniZoomDisplay();
    }
    
    /**
     * 미니 캔버스 줌 아웃
     */
    miniZoomOut() {
        if (!this.miniCore) return;
        this.miniCore.zoomOut();
        this.updateMiniZoomDisplay();
    }
    
    /**
     * 미니 캔버스를 요소에 맞게 조정
     */
    fitMiniCanvasToElements() {
        if (!this.miniCore || !this.miniElementManager) return;
        
        const elements = this.miniCore.state.elements || [];
        
        if (elements.length === 0) {
            // 요소가 없으면 중앙 정렬
            this.miniCore.centerView();
            this.updateMiniZoomDisplay();
            return;
        }
        
        // 모든 요소의 바운딩 박스 계산
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        elements.forEach(element => {
            const x = element.xCoordinate;
            const y = element.yCoordinate;
            const w = element.width || 0;
            const h = element.height || 0;
            
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
        });
        
        // 패딩 추가
        const padding = 100;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        // 요소 영역 크기
        const elementsWidth = maxX - minX;
        const elementsHeight = maxY - minY;
        
        // 캔버스 컨테이너 크기
        const container = this.miniCore.container;
        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        
        // 줌 계산 (요소가 모두 보이도록)
        const zoomX = containerWidth / elementsWidth;
        const zoomY = containerHeight / elementsHeight;
        const zoom = Math.min(zoomX, zoomY, 1.0); // 최대 1.0
        
        // 팬 계산 (요소 중앙이 캔버스 중앙에 오도록)
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        const panX = containerWidth / 2 - centerX * zoom;
        const panY = containerHeight / 2 - centerY * zoom;
        
        // 상태 업데이트
        this.miniCore.setState({
            zoom: zoom,
            panX: panX,
            panY: panY
        });
        
        this.miniCore.markDirty();
        this.miniCore.render();
        this.updateMiniZoomDisplay();
    }
    
    /**
     * 미니 캔버스 줌 디스플레이 업데이트
     */
    updateMiniZoomDisplay() {
        if (!this.miniCore) return;
        const display = document.getElementById('mini-zoom-display');
        if (display) {
            display.textContent = `${Math.round(this.miniCore.state.zoom * 100)}%`;
        }
    }
    
    /**
     * 저장된 레이아웃 로드
     */
    async loadSavedLayout(classroomId) {
        try {
            const schoolId = this.core.currentSchoolId;
            const response = await fetch(`/floorplan/api/schools/${schoolId}/classroom/${classroomId}/seat-layout`);
            const result = await response.json();
            
            if (result.success && result.layout) {
                this.savedLayouts[classroomId] = result.layout;
            } else {
                this.savedLayouts[classroomId] = null;
            }
        } catch (error) {
            console.error('레이아웃 로드 오류:', error);
            this.savedLayouts[classroomId] = null;
        }
    }
    
    /**
     * 저장된 레이아웃 렌더링
     */
    renderSavedLayout() {
        if (!this.miniCore || !this.miniElementManager) return;
        
        const classroomId = this.currentClassroom?.referenceId || this.currentClassroom?.classroomId;
        if (!classroomId || !this.savedLayouts[classroomId]) return;
        
        const layout = this.savedLayouts[classroomId];
        
        // 자리 렌더링 (이름박스 포함)
        if (layout.seats) {
            layout.seats.forEach(seatData => {
                const seat = this.miniElementManager.createElement('seat', {
                    type: 'seat',
                    elementType: 'seat',
                    xCoordinate: seatData.xCoordinate,
                    yCoordinate: seatData.yCoordinate,
                    width: seatData.width || 500,
                    height: seatData.height || 250,
                    borderColor: seatData.borderColor || '#3b82f6',
                    backgroundColor: seatData.backgroundColor || '#dbeafe',
                    borderWidth: seatData.borderWidth || 2,
                    label: seatData.label,
                    zIndex: 1
                });
                
                // 이름박스 렌더링 (있는 경우)
                if (seatData.nameBox) {
                    this.miniElementManager.createElement('name_box', {
                        type: 'name_box',
                        elementType: 'name_box',
                        xCoordinate: seatData.nameBox.xCoordinate,
                        yCoordinate: seatData.nameBox.yCoordinate,
                        width: seatData.nameBox.width || 160,
                        height: seatData.nameBox.height || 40,
                        label: seatData.nameBox.label || seatData.label || '',
                        backgroundColor: seatData.nameBox.backgroundColor || '#ffffff',
                        borderColor: seatData.nameBox.borderColor || '#000000',
                        borderWidth: seatData.nameBox.borderWidth || 2,
                        fontSize: seatData.nameBox.fontSize || 18,
                        parentElementId: seat.id,
                        zIndex: 1
                    });
                }
            });
        }
        
        // 장비 렌더링 (배치된 장비는 목록에서 제거)
        if (layout.devices) {
            const placedDeviceIds = new Set();
            layout.devices.forEach(deviceData => {
                placedDeviceIds.add(String(deviceData.deviceId));
                this.miniElementManager.createElement('device', {
                    type: 'device',
                    elementType: 'device',
                    xCoordinate: deviceData.xCoordinate,
                    yCoordinate: deviceData.yCoordinate,
                    width: deviceData.width || 150,
                    height: deviceData.height || 100,
                    borderColor: deviceData.borderColor || '#000000',
                    backgroundColor: deviceData.backgroundColor || '#f3f4f6',
                    borderWidth: deviceData.borderWidth || 2,
                    deviceId: deviceData.deviceId,
                    deviceData: deviceData.deviceData,
                    zIndex: 3
                });
            });
            
            // 배치된 장비를 목록에서 제거
            if (this.devices && this.devices.length > 0) {
                this.devices = this.devices.filter(device => !placedDeviceIds.has(String(device.deviceId)));
                // 목록 다시 렌더링
                this.renderDeviceCards(this.devices);
            }
        }
        
        // 입구 렌더링
        if (layout.entrances) {
            layout.entrances.forEach(entranceData => {
                this.miniElementManager.createElement('entrance', {
                    type: 'entrance',
                    elementType: 'entrance',
                    xCoordinate: entranceData.xCoordinate,
                    yCoordinate: entranceData.yCoordinate,
                    width: entranceData.width || 200,
                    height: entranceData.height || 150,
                    borderColor: entranceData.borderColor || '#3b82f6',
                    backgroundColor: entranceData.backgroundColor || '#dbeafe',
                    borderWidth: entranceData.borderWidth || 2,
                    label: entranceData.label || '입구',
                    zIndex: 1
                });
            });
        }
        
        this.miniCore.markDirty();
        this.miniCore.render();
        
        // 요소에 맞게 조정
        setTimeout(() => this.fitMiniCanvasToElements(), 100);
    }
    
    /**
     * 자리 배치 저장
     */
    async saveSeatLayout() {
        if (!this.miniCore || !this.miniElementManager || !this.currentClassroom) {
            this.uiManager.showNotification('저장할 데이터가 없습니다', 'warning');
            return;
        }
        
        try {
            const classroomId = this.currentClassroom.referenceId || this.currentClassroom.classroomId;
            const schoolId = this.core.currentSchoolId;
            
            // 미니 캔버스의 모든 요소 가져오기
            const allElements = this.miniCore.state.elements || [];
            
            // 요소 타입별로 분류
            const seats = allElements.filter(el => el.elementType === 'seat').map(el => {
                // 자리의 이름박스 찾기
                const nameBox = allElements.find(nb => 
                    nb.elementType === 'name_box' && nb.parentElementId === el.id
                );
                
                return {
                    xCoordinate: el.xCoordinate,
                    yCoordinate: el.yCoordinate,
                    width: el.width,
                    height: el.height,
                    borderColor: el.borderColor,
                    backgroundColor: el.backgroundColor,
                    borderWidth: el.borderWidth,
                    label: el.label,
                    nameBox: nameBox ? {
                        xCoordinate: nameBox.xCoordinate,
                        yCoordinate: nameBox.yCoordinate,
                        width: nameBox.width,
                        height: nameBox.height,
                        label: nameBox.label,
                        backgroundColor: nameBox.backgroundColor,
                        borderColor: nameBox.borderColor,
                        borderWidth: nameBox.borderWidth,
                        fontSize: nameBox.fontSize
                    } : null
                };
            });
            
            const devices = allElements.filter(el => el.elementType === 'device').map(el => ({
                xCoordinate: el.xCoordinate,
                yCoordinate: el.yCoordinate,
                width: el.width,
                height: el.height,
                borderColor: el.borderColor,
                backgroundColor: el.backgroundColor,
                borderWidth: el.borderWidth,
                deviceId: el.deviceId,
                deviceData: el.deviceData
            }));
            
            const entrances = allElements.filter(el => el.elementType === 'entrance').map(el => ({
                xCoordinate: el.xCoordinate,
                yCoordinate: el.yCoordinate,
                width: el.width,
                height: el.height,
                borderColor: el.borderColor,
                backgroundColor: el.backgroundColor,
                borderWidth: el.borderWidth,
                label: el.label || '입구'
            }));
            
            const layoutData = {
                classroomId: classroomId,
                seats: seats,
                devices: devices,
                entrances: entrances
            };
            
            // API 호출
            const response = await fetch(`/floorplan/api/schools/${schoolId}/classroom/${classroomId}/seat-layout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(layoutData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.uiManager.showNotification('저장 완료', 'success');
                this.savedLayouts[classroomId] = layoutData;
            } else {
                this.uiManager.showNotification('저장 실패: ' + (result.message || '알 수 없는 오류'), 'error');
            }
        } catch (error) {
            console.error('저장 오류:', error);
            this.uiManager.showNotification('저장 중 오류가 발생했습니다', 'error');
        }
    }
    
    /**
     * 모달 닫기
     */
    closeModal() {
        // 수정 모드 상태 초기화
        this.isEditMode = false;
        const editBtn = document.getElementById('edit-mode-btn');
        if (editBtn) {
            editBtn.classList.remove('active');
            editBtn.innerHTML = '<i class="fas fa-edit"></i> 수정 모드';
        }
        const modal = document.getElementById('seat-layout-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // 모드 해제
        this.seatPlacementMode = false;
        this.entrancePlacementMode = false;
        this.selectedDevice = null;
        
        // 버튼 상태 리셋
        const seatBtn = document.getElementById('add-seat-btn');
        if (seatBtn) seatBtn.classList.remove('active');
        const entranceBtn = document.getElementById('add-entrance-btn');
        if (entranceBtn) entranceBtn.classList.remove('active');
        
        // 장비 카드 선택 해제
        document.querySelectorAll('.device-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // 미니 캔버스 정리
        if (this.miniCore && this.miniCore.canvas) {
            this.miniCore.canvas.style.cursor = 'default';
            
            // 이벤트 리스너 제거
            if (this.miniCanvasMouseDownHandler) {
                this.miniCore.canvas.removeEventListener('mousedown', this.miniCanvasMouseDownHandler, true);
                this.miniCanvasMouseDownHandler = null;
            }
            if (this.miniCanvasMouseUpHandler) {
                this.miniCore.canvas.removeEventListener('mouseup', this.miniCanvasMouseUpHandler, true);
                this.miniCanvasMouseUpHandler = null;
            }
            if (this.miniCanvasTouchStartHandler) {
                this.miniCore.canvas.removeEventListener('touchstart', this.miniCanvasTouchStartHandler);
                this.miniCanvasTouchStartHandler = null;
            }
            if (this.miniCanvasTouchEndHandler) {
                this.miniCore.canvas.removeEventListener('touchend', this.miniCanvasTouchEndHandler);
                this.miniCanvasTouchEndHandler = null;
            }
            if (this.miniCanvasWheelHandler) {
                this.miniCore.canvas.removeEventListener('wheel', this.miniCanvasWheelHandler);
                this.miniCanvasWheelHandler = null;
            }
        }
        
        // 리사이즈 옵저버 정리
        if (this._miniCanvasResizeObserver) {
            this._miniCanvasResizeObserver.disconnect();
            this._miniCanvasResizeObserver = null;
        }
        
        // InteractionManager는 window에 키보드 이벤트를 등록했으므로,
        // 모달이 닫혀도 키보드 이벤트는 유지됩니다. 하지만 core가 다르므로 문제없습니다.
        
        // 마우스 다운 위치 초기화
        this.miniCanvasMouseDownPos = null;
        
        this.currentClassroom = null;
        this.modalOpen = false;
    }

    getViewModeForButton() {
        return 'view-equipment';
    }

    getViewModeForButton() {
        return 'view-equipment';
    }
    
    /**
     * 교실/건물 잠금
     */
    lockRoomsAndBuildings() {
        const elements = this.elementManager.getAllElements();
        elements.forEach(element => {
            if (element.elementType === 'room' || element.elementType === 'building') {
                element.isLocked = true;
                this.elementManager.updateElement(element.id, { isLocked: true });
            }
        });
        
        console.log('🔒 교실/건물 이동 잠금');
    }
    
    /**
     * 교실/건물 잠금 해제
     */
    unlockRoomsAndBuildings() {
        const elements = this.elementManager.getAllElements();
        elements.forEach(element => {
            if (element.elementType === 'room' || element.elementType === 'building') {
                element.isLocked = false;
                this.elementManager.updateElement(element.id, { isLocked: false });
            }
        });
        
        console.log('🔓 교실/건물 이동 잠금 해제');
    }
}
