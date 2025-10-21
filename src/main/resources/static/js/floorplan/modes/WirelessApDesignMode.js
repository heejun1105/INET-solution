/**
 * WirelessApDesignMode.js
 * 무선AP 설계 모드 매니저
 * 
 * 책임:
 * - 교실 내 무선AP 자동 배치 및 관리
 * - MDF/IDF 네트워크 장비 배치
 * - 무선AP 색상 변경
 * - 교실/건물 이동 잠금
 */

export default class WirelessApDesignMode {
    constructor(core, elementManager, uiManager) {
        this.core = core;
        this.elementManager = elementManager;
        this.uiManager = uiManager;
        
        this.wirelessAps = [];
        this.networkEquipments = [];
        this.selectedAp = null;
        
        this.apColors = [
            { name: '빨강', value: '#ef4444' },
            { name: '주황', value: '#f97316' },
            { name: '노랑', value: '#eab308' },
            { name: '초록', value: '#22c55e' },
            { name: '파랑', value: '#3b82f6' },
            { name: '남색', value: '#4f46e5' },
            { name: '보라', value: '#a855f7' },
            { name: '검정', value: '#000000' }
        ];
        
        console.log('📡 WirelessApDesignMode 초기화');
    }
    
    /**
     * 모드 활성화
     */
    async activate() {
        console.log('✅ 무선AP설계 모드 활성화');
        
        // 교실/건물 잠금
        this.lockRoomsAndBuildings();
        
        this.setupUI();
        await this.loadWirelessAps();
        await this.loadNetworkEquipments();
        this.renderWirelessAps();
        this.bindEvents();
        
        // 강제 렌더링
        this.core.markDirty();
    }
    
    /**
     * 모드 비활성화
     */
    deactivate() {
        console.log('❌ 무선AP설계 모드 비활성화');
        this.unlockRoomsAndBuildings();
        this.unbindEvents();
        this.clearApElements();
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
                <h3>무선AP 추가</h3>
                <button id="add-wireless-ap-btn" class="primary-btn">
                    <i class="fas fa-wifi"></i> 무선AP 배치
                </button>
            </div>
            
            <div class="toolbar-section">
                <h3>네트워크 장비</h3>
                <button id="add-mdf-btn" class="primary-btn">
                    <i class="fas fa-server"></i> MDF 추가
                </button>
                <button id="add-idf-btn" class="primary-btn">
                    <i class="fas fa-network-wired"></i> IDF 추가
                </button>
            </div>
            
            <div class="toolbar-section">
                <h3>색상 변경</h3>
                <div class="color-palette">
                    ${this.apColors.map(color => `
                        <button class="color-btn" 
                                data-color="${color.value}" 
                                style="background-color: ${color.value}"
                                title="${color.name}">
                        </button>
                    `).join('')}
                </div>
                <p class="hint">무선AP를 선택한 후 색상을 클릭하세요</p>
            </div>
            
            <div class="toolbar-section">
                <h3>무선AP 목록</h3>
                <div id="wireless-ap-list" class="ap-list">
                    <p class="loading">로딩 중...</p>
                </div>
            </div>
        `;
        
        this.bindToolbarEvents();
    }
    
    /**
     * 툴바 이벤트 바인딩
     */
    bindToolbarEvents() {
        // 무선AP 배치 버튼
        const addApBtn = document.getElementById('add-wireless-ap-btn');
        if (addApBtn) {
            addApBtn.addEventListener('click', () => {
                this.enableApPlacementMode();
            });
        }
        
        // MDF 추가 버튼
        const addMdfBtn = document.getElementById('add-mdf-btn');
        if (addMdfBtn) {
            addMdfBtn.addEventListener('click', () => {
                this.enableNetworkEquipmentPlacement('MDF');
            });
        }
        
        // IDF 추가 버튼
        const addIdfBtn = document.getElementById('add-idf-btn');
        if (addIdfBtn) {
            addIdfBtn.addEventListener('click', () => {
                this.enableNetworkEquipmentPlacement('IDF');
            });
        }
        
        // 색상 버튼
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const color = e.currentTarget.dataset.color;
                this.changeSelectedApColor(color);
            });
        });
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
     * 무선AP 데이터 로드
     */
    async loadWirelessAps() {
        try {
            const schoolId = this.core.currentSchoolId;
            const response = await fetch(`/floorplan/api/schools/${schoolId}/wireless-aps`);
            const result = await response.json();
            
            if (result.success) {
                this.wirelessAps = result.wirelessAps;
                this.renderApList();
            }
        } catch (error) {
            console.error('무선AP 로드 오류:', error);
        }
    }
    
    /**
     * 네트워크 장비 로드
     */
    async loadNetworkEquipments() {
        try {
            const schoolId = this.core.currentSchoolId;
            const response = await fetch(`/api/network-equipment/schools/${schoolId}`);
            const result = await response.json();
            
            if (result.success) {
                this.networkEquipments = result.equipments;
                this.renderNetworkEquipments();
            }
        } catch (error) {
            console.error('네트워크 장비 로드 오류:', error);
        }
    }
    
    /**
     * 무선AP 렌더링
     */
    renderWirelessAps() {
        // 교실에 배치된 무선AP 렌더링
        this.wirelessAps.forEach(ap => {
            if (!ap.classroomId) return;
            
            // 교실 요소 찾기
            const roomElement = this.elementManager.findElementByReferenceId(ap.classroomId);
            if (!roomElement) return;
            
            // 무선AP 요소 생성 (교실 하단 중앙)
            const apElement = {
                type: 'wireless_ap',
                referenceId: ap.apId,
                parentElementId: roomElement.id,
                x: roomElement.x + roomElement.width / 2,
                y: roomElement.y + roomElement.height - 10,
                radius: Math.min(roomElement.width, roomElement.height) / 30,
                color: '#ef4444',
                label: ap.newLabelNumber,
                layerOrder: 1000 // 높은 우선순위
            };
            
            this.elementManager.addElement(apElement);
        });
        
        this.core.markDirty();
    }
    
    /**
     * 무선AP 목록 렌더링
     */
    renderApList() {
        const container = document.getElementById('wireless-ap-list');
        if (!container) return;
        
        if (this.wirelessAps.length === 0) {
            container.innerHTML = '<p class="empty">등록된 무선AP가 없습니다</p>';
            return;
        }
        
        container.innerHTML = this.wirelessAps.map(ap => `
            <div class="ap-item" data-ap-id="${ap.apId}">
                <div class="ap-info">
                    <strong>${ap.newLabelNumber}</strong>
                    <small>${ap.classroomName || '미배치'}</small>
                </div>
                <div class="ap-model">${ap.model || ''}</div>
            </div>
        `).join('');
    }
    
    /**
     * 네트워크 장비 렌더링
     */
    renderNetworkEquipments() {
        this.networkEquipments.forEach(equipment => {
            const element = {
                type: 'network_equipment',
                referenceId: equipment.equipmentId,
                x: equipment.xCoordinate,
                y: equipment.yCoordinate,
                width: equipment.width || 50,
                height: equipment.height || 65,
                name: equipment.name,
                equipmentType: equipment.equipmentType,
                color: equipment.color || '#3b82f6',
                layerOrder: 900
            };
            
            this.elementManager.addElement(element);
        });
        
        this.core.markDirty();
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
        
        if (clickedElement && clickedElement.type === 'wireless_ap') {
            this.selectAp(clickedElement);
        } else {
            this.selectedAp = null;
        }
    }
    
    /**
     * 무선AP 선택
     */
    selectAp(apElement) {
        this.selectedAp = apElement;
        console.log('📡 무선AP 선택:', apElement);
        
        // UI 업데이트 (선택 표시)
        this.uiManager.showNotification('무선AP 선택됨. 색상을 선택하세요.', 'info');
    }
    
    /**
     * 선택된 무선AP 색상 변경
     */
    changeSelectedApColor(color) {
        if (!this.selectedAp) {
            this.uiManager.showNotification('먼저 무선AP를 선택하세요', 'warning');
            return;
        }
        
        this.selectedAp.color = color;
        this.core.markDirty();
        
        console.log('🎨 무선AP 색상 변경:', color);
    }
    
    /**
     * 무선AP 배치 모드 활성화
     */
    enableApPlacementMode() {
        this.uiManager.showNotification('캔버스를 클릭하여 무선AP를 배치하세요', 'info');
        
        const handler = (e) => {
            const rect = this.core.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const canvasPos = this.core.screenToCanvas(x, y);
            
            this.placeNewAp(canvasPos.x, canvasPos.y);
            
            this.core.canvas.removeEventListener('click', handler);
        };
        
        this.core.canvas.addEventListener('click', handler);
    }
    
    /**
     * 새 무선AP 배치
     */
    placeNewAp(x, y) {
        const label = prompt('라벨 번호를 입력하세요:', 'AP-001');
        if (!label) return;
        
        const element = {
            type: 'wireless_ap',
            x: x,
            y: y,
            radius: 10,
            color: '#ef4444',
            label: label,
            layerOrder: 1000
        };
        
        this.elementManager.addElement(element);
        this.core.markDirty();
        
        console.log('✅ 새 무선AP 배치:', element);
    }
    
    /**
     * 네트워크 장비 배치 모드 활성화
     */
    enableNetworkEquipmentPlacement(type) {
        const name = prompt(`${type} 이름을 입력하세요:`, `${type}-1`);
        if (!name) return;
        
        this.uiManager.showNotification('캔버스를 클릭하여 배치하세요', 'info');
        
        const handler = (e) => {
            const rect = this.core.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const canvasPos = this.core.screenToCanvas(x, y);
            
            this.placeNetworkEquipment(type, name, canvasPos.x, canvasPos.y);
            
            this.core.canvas.removeEventListener('click', handler);
        };
        
        this.core.canvas.addEventListener('click', handler);
    }
    
    /**
     * 네트워크 장비 배치
     */
    async placeNetworkEquipment(type, name, x, y) {
        try {
            const schoolId = this.core.currentSchoolId;
            
            const response = await fetch('/api/network-equipment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    schoolId: schoolId,
                    name: name,
                    equipmentType: type,
                    xCoordinate: x,
                    yCoordinate: y,
                    width: 50,
                    height: 65,
                    color: '#3b82f6'
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                const element = {
                    type: 'network_equipment',
                    referenceId: result.equipment.equipmentId,
                    x: x,
                    y: y,
                    width: 50,
                    height: 65,
                    name: name,
                    equipmentType: type,
                    color: '#3b82f6',
                    layerOrder: 900
                };
                
                this.elementManager.addElement(element);
                this.core.markDirty();
                
                this.uiManager.showNotification(`${type} 추가 완료`, 'success');
                
                console.log('✅ 네트워크 장비 배치:', element);
            }
        } catch (error) {
            console.error('네트워크 장비 배치 오류:', error);
            this.uiManager.showNotification('배치 실패', 'error');
        }
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
        
        console.log('🔒 교실/건물 이동 잠금');
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
        
        console.log('🔓 교실/건물 이동 잠금 해제');
    }
    
    /**
     * AP 요소 제거
     */
    clearApElements() {
        const elements = this.elementManager.getAllElements();
        const apElements = elements.filter(e => 
            e.type === 'wireless_ap' || e.type === 'network_equipment'
        );
        
        apElements.forEach(element => {
            this.elementManager.removeElement(element.id);
        });
    }
    
    /**
     * 저장
     */
    async save() {
        try {
            const schoolId = this.core.currentSchoolId;
            const elements = this.elementManager.getAllElements();
            
            const apElements = elements.filter(e => e.type === 'wireless_ap');
            const networkElements = elements.filter(e => e.type === 'network_equipment');
            
            // 무선AP 위치 및 색상 저장
            const apData = apElements.map(e => ({
                id: e.referenceId,
                x: e.x,
                y: e.y,
                color: e.color,
                parentElementId: e.parentElementId
            }));
            
            // 네트워크 장비 위치 저장
            const networkData = networkElements.map(e => ({
                id: e.referenceId,
                x: e.x,
                y: e.y,
                color: e.color
            }));
            
            // 서버에 저장 (구현 필요)
            console.log('💾 무선AP 저장 데이터:', { apData, networkData });
            
            this.uiManager.showNotification('저장 완료', 'success');
        } catch (error) {
            console.error('저장 오류:', error);
            this.uiManager.showNotification('저장 실패', 'error');
        }
    }
}

