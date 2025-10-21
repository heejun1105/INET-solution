/**
 * SeatLayoutMode.js
 * 자리배치 설계 모드 매니저
 * 
 * 책임:
 * - 교실 클릭 시 미니 캔버스 모달 표시
 * - 교실 내 자리 배치
 * - 장비를 자리에 드래그앤드롭으로 배치
 */

export default class SeatLayoutMode {
    constructor(core, elementManager, uiManager) {
        this.core = core;
        this.elementManager = elementManager;
        this.uiManager = uiManager;
        
        this.currentClassroom = null;
        this.modalOpen = false;
        
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
    }
    
    /**
     * UI 설정
     */
    setupUI() {
        const toolbar = document.getElementById('design-toolbar');
        if (!toolbar) return;
        
        // 도구창 간소화 토글 버튼 추가
        const toolbarContainer = document.getElementById('design-toolbar-container');
        if (toolbarContainer && !document.getElementById('toolbar-toggle-btn')) {
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'toolbar-toggle-btn';
            toggleBtn.className = 'toolbar-toggle-btn';
            toggleBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            toggleBtn.title = '도구창 접기/펼치기';
            toolbarContainer.insertBefore(toggleBtn, toolbar);
            
            // 저장된 상태 불러오기
            const isCollapsed = localStorage.getItem('toolbar-collapsed') === 'true';
            if (isCollapsed) {
                toolbarContainer.classList.add('collapsed');
            }
            
            // 토글 이벤트
            toggleBtn.addEventListener('click', () => {
                toolbarContainer.classList.toggle('collapsed');
                const collapsed = toolbarContainer.classList.contains('collapsed');
                localStorage.setItem('toolbar-collapsed', collapsed);
            });
        }
        
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
        this.canvasClickHandler = (e) => this.handleCanvasClick(e);
        
        const canvas = this.core.canvas;
        canvas.addEventListener('click', this.canvasClickHandler);
    }
    
    /**
     * 이벤트 해제
     */
    unbindEvents() {
        const canvas = this.core.canvas;
        if (this.canvasClickHandler) {
            canvas.removeEventListener('click', this.canvasClickHandler);
        }
    }
    
    /**
     * 캔버스 클릭 처리
     */
    handleCanvasClick(e) {
        const rect = this.core.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const canvasPos = this.core.screenToCanvas(x, y);
        
        // 클릭된 요소 찾기
        const clickedElement = this.elementManager.getElementAtPosition(canvasPos.x, canvasPos.y);
        
        if (clickedElement && clickedElement.type === 'room') {
            this.openClassroomModal(clickedElement);
        }
    }
    
    /**
     * 교실 모달 열기
     */
    async openClassroomModal(roomElement) {
        this.currentClassroom = roomElement;
        this.modalOpen = true;
        
        // 모달 생성
        const modal = document.getElementById('classroom-modal');
        if (!modal) {
            this.createModal();
        }
        
        // 교실 정보 로드
        await this.loadClassroomDevices(roomElement.referenceId);
        
        // 모달 표시
        document.getElementById('classroom-modal').style.display = 'flex';
        
        console.log('📖 교실 모달 열기:', roomElement);
    }
    
    /**
     * 모달 생성
     */
    createModal() {
        const modal = document.createElement('div');
        modal.id = 'classroom-modal';
        modal.className = 'classroom-modal-overlay';
        modal.innerHTML = `
            <div class="classroom-modal-content">
                <div class="modal-header">
                    <h2 id="classroom-modal-title">교실 자리 배치</h2>
                    <button id="close-classroom-modal" class="close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="modal-canvas-container">
                        <canvas id="mini-canvas" width="600" height="400"></canvas>
                    </div>
                    <div class="modal-sidebar">
                        <h3>장비 목록</h3>
                        <div id="device-cards-container" class="device-cards">
                            <p class="loading">로딩 중...</p>
                        </div>
                        <button id="add-seat-btn" class="primary-btn">
                            <i class="fas fa-plus"></i> 자리 추가
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="save-seat-layout-btn" class="primary-btn">저장</button>
                    <button id="cancel-seat-layout-btn" class="secondary-btn">취소</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 이벤트 바인딩
        document.getElementById('close-classroom-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancel-seat-layout-btn').addEventListener('click', () => this.closeModal());
        document.getElementById('save-seat-layout-btn').addEventListener('click', () => this.saveSeatLayout());
        document.getElementById('add-seat-btn').addEventListener('click', () => this.addSeat());
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
                this.renderDeviceCards(result.devices);
            }
        } catch (error) {
            console.error('장비 로드 오류:', error);
        }
    }
    
    /**
     * 장비 카드 렌더링
     */
    renderDeviceCards(devices) {
        const container = document.getElementById('device-cards-container');
        if (!container) return;
        
        if (devices.length === 0) {
            container.innerHTML = '<p class="empty">등록된 장비가 없습니다</p>';
            return;
        }
        
        container.innerHTML = devices.map(device => `
            <div class="device-card" draggable="true" data-device-id="${device.deviceId}">
                <div class="device-type">${device.type}</div>
                <div class="device-info">
                    <div class="info-row">고유번호: ${device.uidNumber || '-'}</div>
                    <div class="info-row">관리번호: ${device.manageNumber || '-'}</div>
                    <div class="info-row">담당자: ${device.operatorName || '-'}</div>
                    <div class="info-row">세트번호: ${device.setType || '-'}</div>
                </div>
            </div>
        `).join('');
        
        // 드래그 이벤트 설정
        this.setupDeviceDragEvents();
    }
    
    /**
     * 장비 드래그 이벤트 설정
     */
    setupDeviceDragEvents() {
        document.querySelectorAll('.device-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('deviceId', card.dataset.deviceId);
            });
        });
        
        const miniCanvas = document.getElementById('mini-canvas');
        if (miniCanvas) {
            miniCanvas.addEventListener('dragover', (e) => {
                e.preventDefault();
            });
            
            miniCanvas.addEventListener('drop', (e) => {
                e.preventDefault();
                const deviceId = e.dataTransfer.getData('deviceId');
                // 미니 캔버스에 장비 배치 (구현 필요)
                console.log('장비 배치:', deviceId);
            });
        }
    }
    
    /**
     * 자리 추가
     */
    addSeat() {
        // 미니 캔버스에 자리 사각형 추가 (구현 필요)
        this.uiManager.showNotification('미니 캔버스를 클릭하여 자리를 배치하세요', 'info');
    }
    
    /**
     * 자리 배치 저장
     */
    async saveSeatLayout() {
        try {
            // 자리 배치 정보 저장 (구현 필요)
            this.uiManager.showNotification('저장 완료', 'success');
            this.closeModal();
        } catch (error) {
            console.error('저장 오류:', error);
            this.uiManager.showNotification('저장 실패', 'error');
        }
    }
    
    /**
     * 모달 닫기
     */
    closeModal() {
        const modal = document.getElementById('classroom-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        this.currentClassroom = null;
        this.modalOpen = false;
    }
    
    /**
     * 교실/건물 잠금
     */
    lockRoomsAndBuildings() {
        const elements = this.elementManager.getAllElements();
        elements.forEach(element => {
            if (element.type === 'room' || element.type === 'building') {
                element.isLocked = true;
            }
        });
    }
    
    /**
     * 교실/건물 잠금 해제
     */
    unlockRoomsAndBuildings() {
        const elements = this.elementManager.getAllElements();
        elements.forEach(element => {
            if (element.type === 'room' || element.type === 'building') {
                element.isLocked = false;
            }
        });
    }
}

