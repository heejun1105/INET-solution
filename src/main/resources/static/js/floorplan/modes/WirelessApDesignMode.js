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
        this.selectedElement = null; // AP 또는 MDF 선택용
        this.currentTool = null; // 'mdf-idf'
        
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
        
        // 먼저 기존 AP/MDF 요소 모두 제거 (중복 방지)
        this.clearApElements();
        
        // 교실/건물 잠금
        this.lockRoomsAndBuildings();
        
        this.setupUI();
        
        // 무선AP 데이터 로드
        await this.loadWirelessAps();
        await this.loadNetworkEquipments();
        
        // 교실 요소가 로드될 때까지 약간 대기 (모드 전환 시 평면도 로드 완료 대기)
        await this.waitForRoomElements();
        
        // 저장된 AP/MDF 위치 로드
        await this.loadSavedApMdfElements();
        
        // 무선AP 렌더링 (저장된 위치가 없으면 기본 위치에 배치)
        this.renderWirelessAps();
        this.bindEvents();
        
        // 강제 렌더링
        this.core.markDirty();
    }
    
    /**
     * 교실 요소 로드 대기
     */
    async waitForRoomElements() {
        // 최대 5번 재시도 (500ms 간격)
        for (let i = 0; i < 5; i++) {
            const roomElements = this.core.state.elements.filter(e => e.elementType === 'room');
            if (roomElements.length > 0) {
                console.log('✅ 교실 요소 확인:', roomElements.length, '개');
                return;
            }
            
            console.log(`⏳ 교실 요소 대기 중... (${i + 1}/5)`);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.warn('⚠️ 교실 요소를 찾지 못했습니다');
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
                <h3>네트워크 장비</h3>
                <button id="add-mdf-idf-btn" class="primary-btn">
                    <i class="fas fa-server"></i> MDF(IDF) 추가
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
                <p class="hint">무선AP 또는 MDF를 선택한 후 색상을 클릭하세요</p>
            </div>
        `;
        
        this.bindToolbarEvents();
    }
    
    /**
     * 툴바 이벤트 바인딩
     */
    bindToolbarEvents() {
        // MDF(IDF) 추가 버튼
        const addMdfIdfBtn = document.getElementById('add-mdf-idf-btn');
        if (addMdfIdfBtn) {
            addMdfIdfBtn.addEventListener('click', () => {
                this.enableMdfIdfPlacementMode();
            });
        }
        
        // 색상 버튼
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // 팔레트 클릭 시 캔버스 클릭으로 인한 선택 해제 방지
                e.stopPropagation();
                const color = e.currentTarget.dataset.color;
                // 선택 요소가 비어 있으면 Core의 선택 상태에서 보강
                if (!this.selectedElement) {
                    const selected = this.core.state.selectedElements && this.core.state.selectedElements[0];
                    if (selected) {
                        this.selectedElement = selected;
                    }
                }
                this.changeSelectedElementColor(color);
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
        
        // 모바일/태블릿: 터치 이벤트도 처리 (MDF 배치용)
        this.canvasTouchStartHandler = (e) => {
            if (e.touches && e.touches.length > 0) {
                const touch = e.touches[0];
                // 터치를 클릭 이벤트처럼 처리하기 위해 기록만 함 (touchend에서 처리)
                this.touchStartPos = { x: touch.clientX, y: touch.clientY };
            }
        };
        this.canvasTouchEndHandler = (e) => {
            const touch = e.changedTouches && e.changedTouches.length > 0 
                ? e.changedTouches[0] 
                : (e.touches && e.touches.length > 0 ? e.touches[0] : null);
            
            if (touch && this.touchStartPos) {
                // 실제 클릭인지 확인 (드래그가 아닌 경우)
                const dx = touch.clientX - this.touchStartPos.x;
                const dy = touch.clientY - this.touchStartPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 6px 이내 이동이면 클릭으로 간주
                if (distance <= 6) {
                    this.handleCanvasClick({
                        preventDefault: () => e.preventDefault(),
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        target: e.target
                    });
                }
                
                this.touchStartPos = null;
            }
        };
        
        canvas.addEventListener('touchstart', this.canvasTouchStartHandler, { passive: false });
        canvas.addEventListener('touchend', this.canvasTouchEndHandler, { passive: false });
    }
    
    /**
     * 이벤트 해제
     */
    unbindEvents() {
        const canvas = this.core.canvas;
        if (this.canvasClickHandler) {
            canvas.removeEventListener('click', this.canvasClickHandler);
        }
        // 터치 이벤트 해제
        if (this.canvasTouchStartHandler) {
            canvas.removeEventListener('touchstart', this.canvasTouchStartHandler);
        }
        if (this.canvasTouchEndHandler) {
            canvas.removeEventListener('touchend', this.canvasTouchEndHandler);
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
        console.log('📡 무선AP 렌더링 시작:', this.wirelessAps.length, '개');
        
        // Core state에서 직접 모든 무선AP 요소 제거 (강제)
        const allElements = [...(this.core.state.elements || [])];
        const existingAps = allElements.filter(e => e.elementType === 'wireless_ap');
        console.log('🗑️ 기존 무선AP 제거:', existingAps.length, '개');
        
        if (existingAps.length > 0) {
            // Core state에서 직접 제거 (동기적으로)
            const remainingElements = allElements.filter(e => e.elementType !== 'wireless_ap');
            this.core.setState({ elements: remainingElements });
            console.log('🗑️ Core state에서 무선AP 제거 완료 (제거 전:', allElements.length, '→ 제거 후:', remainingElements.length, ')');
        }
        
        // 교실에 배치된 무선AP 렌더링
        let createdCount = 0;
        let skippedCount = 0;
        const processedApIds = new Set(); // 중복 방지용 Set
        
        // 교실 요소 확인
        const roomElements = this.core.state.elements.filter(e => e.elementType === 'room');
        console.log('📚 교실 요소 개수:', roomElements.length);
        
        this.wirelessAps.forEach(ap => {
            if (!ap.classroomId) {
                console.log('⚠️ classroomId 없음:', ap.apId);
                skippedCount++;
                return;
            }
            
            // 동일한 apId로 이미 처리했는지 확인
            if (processedApIds.has(ap.apId)) {
                console.log('⚠️ 이미 처리된 AP (스킵):', ap.apId);
                skippedCount++;
                return;
            }
            processedApIds.add(ap.apId);
            
            // 교실 요소 찾기 (referenceId로 찾기)
            const roomElement = this.elementManager.findElementByReferenceId(ap.classroomId);
            if (!roomElement) {
                console.log('⚠️ 교실 요소를 찾을 수 없음 - classroomId:', ap.classroomId, '교실명:', ap.classroomName);
                
                // 디버깅: 모든 교실 요소 출력
                const allRooms = this.core.state.elements.filter(e => e.elementType === 'room');
                console.log('📚 현재 로드된 교실들:', allRooms.map(r => ({
                    id: r.id,
                    referenceId: r.referenceId,
                    classroomId: r.classroomId,
                    label: r.label
                })));
                
                skippedCount++;
                return;
            }
            
            // referenceId 기준으로 이미 존재하는지 최종 확인 (Core state에서 직접)
            const currentElements = this.core.state.elements || [];
            const duplicateAp = currentElements.find(e => 
                e.elementType === 'wireless_ap' && 
                e.referenceId === ap.apId
            );
            
            if (duplicateAp) {
                console.log('⚠️ 중복 AP 발견 (생성 스킵):', ap.apId, '기존 ID:', duplicateAp.id);
                skippedCount++;
                return;
            }
            
            // 저장된 위치 확인
            const savedPosition = this.getSavedApPosition(ap.apId);
            
            // 지름 40 = 반지름 20
            const apRadius = 20;
            let xCoordinate, yCoordinate;
            let backgroundColor = '#ef4444';
            let borderColor = '#000000';
            
            if (savedPosition) {
                // 저장된 위치 사용 (저장된 위치는 중앙 좌표로 저장됨)
                // 중앙 좌표에서 반지름을 빼서 좌상단 좌표로 변환
                xCoordinate = savedPosition.x - apRadius;
                yCoordinate = savedPosition.y - apRadius;
                backgroundColor = savedPosition.backgroundColor || backgroundColor;
                borderColor = savedPosition.borderColor || borderColor;
                console.log('✅ 저장된 AP 위치 사용:', ap.apId, { 
                    centerX: savedPosition.x, 
                    centerY: savedPosition.y,
                    leftTopX: xCoordinate,
                    leftTopY: yCoordinate
                });
            } else {
                // 기본 위치 (교실 중앙 살짝 아래) - 20px 아래로 이동
                const centerX = roomElement.xCoordinate + roomElement.width / 2;
                const centerY = roomElement.yCoordinate + roomElement.height / 2 + 30;
                xCoordinate = centerX - apRadius;
                yCoordinate = centerY - apRadius;
            }
            
            const apElement = {
                // 타입은 히트테스트에 사용됨 (선택 가능하도록 필수)
                type: 'wireless_ap',
                elementType: 'wireless_ap',
                xCoordinate: xCoordinate,
                yCoordinate: yCoordinate,
                width: apRadius * 2, // 지름
                height: apRadius * 2, // 지름 (원형이므로)
                radius: apRadius,
                borderColor: borderColor,
                backgroundColor: backgroundColor,
                borderWidth: 2,
                referenceId: ap.apId,
                parentElementId: roomElement.id,
                label: ap.newLabelNumber,
                zIndex: 1000 // 높은 우선순위
            };
            
            this.elementManager.createElement('wireless_ap', apElement);
            createdCount++;
            console.log('✅ AP 생성:', ap.apId, ap.newLabelNumber, '교실:', roomElement.label || roomElement.id);
        });
        
        console.log('✅ 무선AP 렌더링 완료: 생성', createdCount, '개, 스킵', skippedCount, '개');
        this.core.markDirty();
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
        // screenToCanvas는 내부에서 getBoundingClientRect를 처리하므로 clientX/Y를 직접 전달
        const canvasPos = this.core.screenToCanvas(e.clientX, e.clientY);
        
        console.log('🖱️ Canvas click:', {
            client: { x: e.clientX, y: e.clientY },
            canvas: { x: canvasPos.x, y: canvasPos.y },
            zoom: this.core.state.zoom,
            pan: { x: this.core.state.panX, y: this.core.state.panY }
        });
        
        // MDF(IDF) 배치 모드인 경우
        if (this.currentTool === 'mdf-idf') {
            this.placeMdfIdf(canvasPos.x, canvasPos.y);
            this.currentTool = null;
            return;
        }
        
        // 클릭된 요소 찾기
        const clickedElement = this.elementManager.getElementAtPosition(canvasPos.x, canvasPos.y);
        console.log('🔎 HitTest clickedElement:', clickedElement);
        
        if (clickedElement && (clickedElement.elementType === 'wireless_ap' || clickedElement.elementType === 'mdf_idf')) {
            this.selectElement(clickedElement);
        } else {
            this.selectedElement = null;
        }
    }
    
    /**
     * 요소 선택 (AP 또는 MDF)
     */
    selectElement(element) {
        this.selectedElement = element;
        const elementType = element.elementType === 'wireless_ap' ? '무선AP' : 'MDF(IDF)';
        console.log(`📡 ${elementType} 선택:`, element);
        
        // UI 업데이트 (선택 표시)
        this.uiManager.showNotification(`${elementType} 선택됨. 색상을 선택하세요.`, 'info');
        
        // Core의 선택 상태도 업데이트
        this.core.setState({ selectedElements: [element] });
    }
    
    /**
     * 선택된 요소 색상 변경 (AP 또는 MDF)
     */
    changeSelectedElementColor(color) {
        if (!this.selectedElement) {
            this.uiManager.showNotification('먼저 무선AP 또는 MDF를 선택하세요', 'warning');
            return;
        }
        
        // backgroundColor 변경 (wireless_ap, mdf_idf 모두)
        this.selectedElement.backgroundColor = color;
        
        // Core 업데이트
        this.elementManager.updateElement(this.selectedElement.id, { backgroundColor: color });
        this.core.markDirty();
        
        const elementType = this.selectedElement.elementType === 'wireless_ap' ? '무선AP' : 'MDF(IDF)';
        console.log(`🎨 ${elementType} 색상 변경:`, color);
    }
    
    /**
     * MDF(IDF) 배치 모드 활성화
     */
    enableMdfIdfPlacementMode() {
        this.currentTool = 'mdf-idf';
        // Core 상태 업데이트 (InteractionManager가 클릭 이벤트를 처리하도록)
        this.core.setState({ activeTool: 'mdf-idf' });
        this.uiManager.showNotification('캔버스를 클릭하여 MDF(IDF)를 배치하세요', 'info');
    }
    
    /**
     * MDF(IDF) 배치
     */
    placeMdfIdf(x, y) {
        // 클릭 위치에 중앙 정렬로 배치 (교실 배치와 동일한 방식)
        const prevSnap = this.core.state.snapToGrid;
        if (prevSnap) this.core.setState({ snapToGrid: false });
        
        const mdfWidth = 40;
        const mdfHeight = 60;
        // 중앙 정렬: 클릭 위치에서 너비/높이의 절반씩 빼서 좌상단 좌표 계산
        const mdfX = Math.round(x - mdfWidth / 2);
        const mdfY = Math.round(y - mdfHeight / 2);
        
        const mdfElement = {
            type: 'mdf_idf',
            elementType: 'mdf_idf',
            xCoordinate: mdfX,  // 중앙 정렬된 좌상단 좌표
            yCoordinate: mdfY,
            width: mdfWidth,
            height: mdfHeight,
            borderColor: '#000000',
            backgroundColor: '#ef4444',
            borderWidth: 2,
            zIndex: 900
        };
        
        this.elementManager.createElement('mdf_idf', mdfElement);
        
        if (prevSnap) this.core.setState({ snapToGrid: true });
        
        this.core.markDirty();
        console.log('✅ MDF(IDF) 배치 (중앙 정렬):', mdfElement);
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
    
    /**
     * AP/MDF 요소 제거
     */
    clearApElements() {
        const elements = this.elementManager.getAllElements();
        const apElements = elements.filter(e => 
            e.elementType === 'wireless_ap' || e.elementType === 'mdf_idf' || e.elementType === 'network_equipment'
        );
        
        apElements.forEach(element => {
            this.elementManager.removeElement(element.id);
        });
    }
    
    /**
     * 저장된 AP/MDF 요소 로드
     */
    async loadSavedApMdfElements() {
        try {
            const schoolId = this.core.currentSchoolId;
            if (!schoolId) return;
            
            // 평면도 데이터 로드
            const response = await fetch(`/floorplan/api/schools/${schoolId}`);
            const result = await response.json();
            
            if (!result.success || !result.data || !result.data.elements) {
                console.log('ℹ️ 저장된 AP/MDF 데이터 없음');
                return;
            }
            
            const elements = result.data.elements;
            const savedAps = elements.filter(el => el.elementType === 'wireless_ap');
            const savedMdfs = elements.filter(el => el.elementType === 'mdf_idf');
            
            console.log('📥 저장된 AP/MDF 로드:', {
                ap: savedAps.length,
                mdf: savedMdfs.length
            });
            
            // 저장된 MDF 요소 추가
            savedMdfs.forEach(mdfData => {
                const mdfElement = {
                    id: mdfData.id || `mdf_${Date.now()}_${Math.random()}`,
                    elementType: 'mdf_idf',
                    xCoordinate: mdfData.xCoordinate,
                    yCoordinate: mdfData.yCoordinate,
                    width: mdfData.width || 40,
                    height: mdfData.height || 60,
                    borderColor: mdfData.borderColor || '#000000',
                    backgroundColor: mdfData.backgroundColor || '#ef4444',
                    borderWidth: mdfData.borderWidth || 2,
                    zIndex: mdfData.zIndex || 900
                };
                
                this.elementManager.addElement(mdfElement);
                console.log('✅ 저장된 MDF 로드:', mdfElement);
            });
            
            // 저장된 AP 위치 맵 생성 (referenceId 기준)
            this.savedApPositions = {};
            savedAps.forEach(apData => {
                if (apData.referenceId) {
                    this.savedApPositions[apData.referenceId] = {
                        x: apData.xCoordinate,
                        y: apData.yCoordinate,
                        backgroundColor: apData.backgroundColor,
                        borderColor: apData.borderColor
                    };
                }
            });
            
        } catch (error) {
            console.error('저장된 AP/MDF 로드 오류:', error);
        }
    }
    
    /**
     * 저장된 AP 위치 적용 (renderWirelessAps에서 사용)
     */
    getSavedApPosition(apId) {
        if (!this.savedApPositions) return null;
        return this.savedApPositions[apId] || null;
    }
}

