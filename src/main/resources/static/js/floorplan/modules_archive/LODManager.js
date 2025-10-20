/**
 * Level of Detail (LOD) 관리자
 * 줌 레벨과 편집 모드에 따라 세부사항을 동적으로 조절하여 성능 최적화
 */
export default class LODManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.currentLODLevel = 2; // 0: 최소, 1: 기본, 2: 최대
        this.isEditMode = false;
        this.deviceIconsVisible = true;
        
        // 렌더링 큐 관리
        this.renderQueue = new Set();
        this.isProcessingQueue = false;
        
        // 성능 모니터링
        this.performanceMetrics = {
            renderTime: 0,
            elementCount: 0,
            lastUpdate: Date.now()
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.createLODControls();
    }
    
    bindEvents() {
        // 줌 레벨 변경 감지
        if (this.floorPlanManager.zoomManager) {
            this.floorPlanManager.zoomManager.onZoomChange = (zoomLevel) => {
                this.updateLODByZoom(zoomLevel);
            };
        }
        
        // 모드 변경 감지
        document.addEventListener('modeChanged', (event) => {
            this.setEditMode(event.detail.mode === 'layout');
        });
    }
    
    /**
     * LOD 컨트롤 UI 생성
     */
    createLODControls() {
        const controls = document.createElement('div');
        controls.className = 'lod-controls';
        controls.innerHTML = `
            <div class="lod-control-group">
                <label>상세도:</label>
                <select id="lodLevelSelect" class="lod-select">
                    <option value="0">최소 (빠름)</option>
                    <option value="1">기본</option>
                    <option value="2" selected>최대 (상세)</option>
                </select>
                <button id="lodToggleDevices" class="lod-toggle ${this.deviceIconsVisible ? 'active' : ''}">
                    <i class="fas fa-microchip"></i> 장비 아이콘
                </button>
            </div>
            <div class="lod-performance">
                <span id="lodPerformance">렌더링: 0ms | 요소: 0개</span>
            </div>
        `;
        
        // 줌 컨트롤 옆에 추가
        const zoomControls = document.querySelector('.zoom-controls');
        if (zoomControls) {
            zoomControls.parentNode.insertBefore(controls, zoomControls.nextSibling);
        }
        
        this.bindControlEvents(controls);
    }
    
    bindControlEvents(controls) {
        // LOD 레벨 선택
        const lodSelect = controls.querySelector('#lodLevelSelect');
        lodSelect.addEventListener('change', (e) => {
            this.setLODLevel(parseInt(e.target.value));
        });
        
        // 장비 아이콘 토글
        const deviceToggle = controls.querySelector('#lodToggleDevices');
        deviceToggle.addEventListener('click', () => {
            this.toggleDeviceIcons();
        });
    }
    
    /**
     * 줌 레벨에 따른 자동 LOD 조정
     */
    updateLODByZoom(zoomLevel) {
        if (zoomLevel < 0.5) {
            this.setLODLevel(0); // 매우 축소됨 - 최소 상세도
        } else if (zoomLevel < 1.0) {
            this.setLODLevel(1); // 기본 상세도
        } else {
            this.setLODLevel(2); // 최대 상세도
        }
    }
    
    /**
     * LOD 레벨 설정
     */
    setLODLevel(level) {
        if (this.currentLODLevel === level) return;
        
        const startTime = performance.now();
        this.currentLODLevel = level;
        
        // 모든 교실 요소를 다시 렌더링
        this.updateAllRoomElements();
        
        // 성능 메트릭 업데이트
        this.updatePerformanceMetrics(startTime);
        
        console.log(`LOD 레벨 변경: ${level} (${this.getLODDescription(level)})`);
    }
    
    /**
     * 편집 모드 설정
     */
    setEditMode(isEdit) {
        this.isEditMode = isEdit;
        
        if (isEdit) {
            // 편집 모드에서는 장비 아이콘 숨김 (성능 향상)
            this.hideDeviceIcons();
        } else {
            // 보기 모드에서는 LOD에 따라 표시
            this.showDeviceIconsIfNeeded();
        }
    }
    
    /**
     * 장비 아이콘 표시/숨김 토글
     */
    toggleDeviceIcons() {
        this.deviceIconsVisible = !this.deviceIconsVisible;
        
        const toggle = document.querySelector('#lodToggleDevices');
        if (toggle) {
            toggle.classList.toggle('active', this.deviceIconsVisible);
        }
        
        if (this.deviceIconsVisible && !this.isEditMode) {
            this.showDeviceIconsIfNeeded();
        } else {
            this.hideDeviceIcons();
        }
    }
    
    /**
     * 모든 교실 요소 업데이트
     */
    updateAllRoomElements() {
        const roomElements = document.querySelectorAll('.room');
        
        // 큐에 모든 교실 추가
        roomElements.forEach(element => {
            this.renderQueue.add(element);
        });
        
        // 비동기로 처리
        this.processRenderQueue();
    }
    
    /**
     * 렌더링 큐 처리 (성능 최적화)
     */
    async processRenderQueue() {
        if (this.isProcessingQueue) return;
        
        this.isProcessingQueue = true;
        const startTime = performance.now();
        
        while (this.renderQueue.size > 0) {
            const batch = Array.from(this.renderQueue).slice(0, 10); // 배치 처리
            this.renderQueue.clear();
            
            for (const element of batch) {
                this.updateRoomElement(element);
            }
            
            // 브라우저가 숨 쉴 시간 제공
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        
        this.isProcessingQueue = false;
        this.updatePerformanceMetrics(startTime);
    }
    
    /**
     * 개별 교실 요소 업데이트
     */
    updateRoomElement(roomElement) {
        if (!roomElement) return;
        
        const classroomId = roomElement.dataset.classroomId;
        
        switch (this.currentLODLevel) {
            case 0: // 최소 - 이름만
                this.renderMinimalRoom(roomElement);
                break;
                
            case 1: // 기본 - 이름 + 장비 개수
                this.renderBasicRoom(roomElement, classroomId);
                break;
                
            case 2: // 최대 - 모든 세부사항
                this.renderDetailedRoom(roomElement, classroomId);
                break;
        }
    }
    
    /**
     * 최소 상세도 렌더링 (이름만)
     */
    renderMinimalRoom(roomElement) {
        // 장비 아이콘 제거
        const devicesContainer = roomElement.querySelector('.room-devices');
        if (devicesContainer) {
            devicesContainer.style.display = 'none';
        }
        
        // 교실명만 표시
        const nameBox = roomElement.querySelector('.room-name');
        if (nameBox) {
            nameBox.style.fontSize = '0.7rem';
        }
    }
    
    /**
     * 기본 상세도 렌더링 (이름 + 장비 개수)
     */
    renderBasicRoom(roomElement, classroomId) {
        // 기존 장비 아이콘 숨김
        const devicesContainer = roomElement.querySelector('.room-devices');
        if (devicesContainer) {
            devicesContainer.style.display = 'none';
        }
        
        // 간단한 장비 개수 표시
        if (classroomId && this.deviceIconsVisible && !this.isEditMode) {
            this.showDeviceCount(roomElement, classroomId);
        }
    }
    
    /**
     * 최대 상세도 렌더링 (모든 세부사항)
     */
    renderDetailedRoom(roomElement, classroomId) {
        if (classroomId && this.deviceIconsVisible && !this.isEditMode) {
            // 기존 FloorPlanManager의 상세 렌더링 사용
            this.floorPlanManager.loadAndDisplayDeviceIcons(classroomId, roomElement);
        } else {
            this.renderMinimalRoom(roomElement);
        }
    }
    
    /**
     * 간단한 장비 개수 표시
     */
    async showDeviceCount(roomElement, classroomId) {
        try {
            const response = await fetch(`/floorplan/api/classroom/${classroomId}/devices`);
            if (response.ok) {
                const deviceCounts = await response.json();
                const totalCount = Object.values(deviceCounts).reduce((sum, count) => sum + count, 0);
                
                if (totalCount > 0) {
                    let countElement = roomElement.querySelector('.device-count-simple');
                    if (!countElement) {
                        countElement = document.createElement('div');
                        countElement.className = 'device-count-simple';
                        roomElement.appendChild(countElement);
                    }
                    
                    countElement.textContent = `📱${totalCount}`;
                    countElement.style.cssText = `
                        position: absolute;
                        bottom: 4px;
                        right: 4px;
                        background: rgba(59, 130, 246, 0.8);
                        color: white;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 10px;
                        font-weight: 600;
                        z-index: 10;
                    `;
                }
            }
        } catch (error) {
            console.error('장비 개수 조회 실패:', error);
        }
    }
    
    /**
     * 모든 장비 아이콘 숨김
     */
    hideDeviceIcons() {
        const allDeviceContainers = document.querySelectorAll('.room-devices, .device-count-simple');
        allDeviceContainers.forEach(container => {
            container.style.display = 'none';
        });
    }
    
    /**
     * 필요시 장비 아이콘 표시
     */
    showDeviceIconsIfNeeded() {
        if (!this.deviceIconsVisible || this.isEditMode) return;
        
        const roomElements = document.querySelectorAll('.room');
        roomElements.forEach(element => {
            this.renderQueue.add(element);
        });
        
        this.processRenderQueue();
    }
    
    /**
     * 성능 메트릭 업데이트
     */
    updatePerformanceMetrics(startTime) {
        this.performanceMetrics.renderTime = Math.round(performance.now() - startTime);
        this.performanceMetrics.elementCount = document.querySelectorAll('.room, .building, .shape').length;
        this.performanceMetrics.lastUpdate = Date.now();
        
        const performanceDisplay = document.querySelector('#lodPerformance');
        if (performanceDisplay) {
            performanceDisplay.textContent = 
                `렌더링: ${this.performanceMetrics.renderTime}ms | 요소: ${this.performanceMetrics.elementCount}개`;
        }
    }
    
    /**
     * LOD 레벨 설명
     */
    getLODDescription(level) {
        const descriptions = {
            0: '최소 상세도 - 이름만 표시',
            1: '기본 상세도 - 이름 + 장비 개수',
            2: '최대 상세도 - 모든 세부사항'
        };
        return descriptions[level] || '알 수 없음';
    }
    
    /**
     * 현재 LOD 상태 반환
     */
    getCurrentState() {
        return {
            lodLevel: this.currentLODLevel,
            isEditMode: this.isEditMode,
            deviceIconsVisible: this.deviceIconsVisible,
            queueSize: this.renderQueue.size,
            performance: this.performanceMetrics
        };
    }
}
