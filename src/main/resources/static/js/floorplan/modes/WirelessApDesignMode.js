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
        this.shapeButtons = [];
        // FloorPlanApp 레벨에서 savedApPositions 관리 (모드 전환 시에도 유지)
        if (window.floorPlanApp && window.floorPlanApp.savedApPositions) {
            this.savedApPositions = window.floorPlanApp.savedApPositions;
        } else {
        this.savedApPositions = {};
            if (window.floorPlanApp) {
                window.floorPlanApp.savedApPositions = this.savedApPositions;
            }
        }
        
        this.apColors = [
            { name: '빨강', value: '#ef4444' },
            { name: '주황', value: '#f97316' },
            { name: '노랑', value: '#eab308' },
            { name: '연두', value: '#a3e635' },
            { name: '초록', value: '#22c55e' },
            { name: '청록', value: '#14b8a6' },
            { name: '하늘', value: '#38bdf8' },
            { name: '파랑', value: '#3b82f6' },
            { name: '남색', value: '#4f46e5' },
            { name: '보라', value: '#a855f7' },
            { name: '분홍', value: '#ec4899' },
            { name: '검정', value: '#000000' }
        ];
        this.apShapeOptions = [
            { name: '원형', value: 'circle' },
            { name: '삼각형', value: 'triangle' },
            { name: '사각형', value: 'square' },
            { name: '마름모', value: 'diamond' },
            { name: '원형L', value: 'circle-l' }
        ];
        
        console.log('📡 WirelessApDesignMode 초기화');
    }
    
    /**
     * 모드 활성화
     */
    async activate() {
        console.log('✅ 무선AP설계 모드 활성화');
        
        // 현재 페이지 확인 및 설정
        if (this.core) {
            // main_new_v3.js에서 설정한 currentPage를 사용하거나 기본값 1
            this.core.currentPage = this.core.currentPage || 1;
            console.log('📄 무선AP 설계 모드 활성화 - 현재 페이지:', this.core.currentPage);
        }
        
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
        
        this.shapeButtons = [];
        
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
                <h3>무선AP 종류 변경</h3>
                <div class="shape-selector">
                    ${this.apShapeOptions.map(shape => `
                        <button class="shape-btn" 
                                data-shape="${shape.value}" 
                                title="${shape.name}"
                                disabled>
                            <span class="shape-icon ${shape.value}"></span>
                            <span class="shape-label">${shape.name}</span>
                        </button>
                    `).join('')}
                </div>
                <p class="hint">무선AP를 선택한 후 모양을 변경하세요</p>
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
        
        // 모양 변경 버튼
        this.shapeButtons = Array.from(document.querySelectorAll('.shape-btn'));
        this.shapeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const shape = e.currentTarget.dataset.shape;
                this.changeSelectedElementShape(shape);
            });
        });
        
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
        
        this.updateShapeButtons();
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
            console.log('📡 무선AP 데이터 로드 시작 - schoolId:', schoolId);
            const response = await fetch(`/floorplan/api/schools/${schoolId}/wireless-aps`);
            const result = await response.json();
            
            if (result.success) {
                this.wirelessAps = result.wirelessAps;
                console.log('✅ 무선AP 데이터 로드 완료:', this.wirelessAps.length, '개');
                if (this.wirelessAps.length > 0) {
                    console.log('📊 무선AP 샘플 (처음 5개):', this.wirelessAps.slice(0, 5).map(ap => ({
                        apId: ap.apId,
                        classroomId: ap.classroomId,
                        classroomName: ap.classroomName,
                        newLabelNumber: ap.newLabelNumber
                    })));
                }
            } else {
                console.error('❌ 무선AP 로드 실패:', result.message);
            }
        } catch (error) {
            console.error('❌ 무선AP 로드 오류:', error);
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
        
        // 현재 페이지 확인
        const currentPage = this.core.currentPage || 1;
        console.log('📄 현재 페이지:', currentPage);
        
        // Core state에서 직접 현재 페이지의 무선AP 요소만 제거 (강제)
        const allElements = [...(this.core.state.elements || [])];
        const existingAps = allElements.filter(e => {
            if (e.elementType !== 'wireless_ap') return false;
            const apPage = e.pageNumber || 1;
            return apPage === currentPage;
        });
        console.log('🗑️ 현재 페이지의 기존 무선AP 제거:', existingAps.length, '개');
        
        if (existingAps.length > 0) {
            // Core state에서 직접 제거 (동기적으로) - 현재 페이지의 AP만 제거
            const remainingElements = allElements.filter(e => {
                if (e.elementType === 'wireless_ap') {
                    const apPage = e.pageNumber || 1;
                    return apPage !== currentPage; // 현재 페이지가 아닌 AP는 유지
                }
                return true;
            });
            this.core.setState({ elements: remainingElements });
            console.log('🗑️ Core state에서 현재 페이지 무선AP 제거 완료 (제거 전:', allElements.length, '→ 제거 후:', remainingElements.length, ')');
        }
        
        // 교실에 배치된 무선AP 렌더링
        let createdCount = 0;
        let skippedCount = 0;
        const processedApIds = new Set(); // 중복 방지용 Set
        
        // 현재 페이지의 교실 요소만 확인
        const roomElements = this.core.state.elements.filter(e => {
            if (e.elementType !== 'room') return false;
            const roomPage = e.pageNumber || 1;
            return roomPage === currentPage;
        });
        console.log('📚 현재 페이지의 교실 요소 개수:', roomElements.length);
        
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
            
            // 교실 요소 찾기 (여러 방법으로 시도, 타입 변환 포함)
            // classroomId를 숫자로 변환 (문자열일 수 있음)
            const targetClassroomId = typeof ap.classroomId === 'string' 
                ? parseInt(ap.classroomId, 10) 
                : ap.classroomId;
            
            if (!targetClassroomId || isNaN(targetClassroomId)) {
                console.log('⚠️ 유효하지 않은 classroomId:', ap.classroomId, 'AP:', ap.apId);
                skippedCount++;
                return;
            }
            
            let roomElement = this.elementManager.findElementByReferenceId(targetClassroomId);
            
            // referenceId로 찾지 못한 경우 다른 방법으로 찾기 시도
            if (!roomElement) {
                const allRooms = this.core.state.elements.filter(e => e.elementType === 'room');
                roomElement = allRooms.find(r => {
                    // 1. referenceId로 매칭 (타입 변환)
                    const rRefId = typeof r.referenceId === 'string' ? parseInt(r.referenceId, 10) : r.referenceId;
                    if (rRefId && rRefId === targetClassroomId) {
                        return true;
                    }
                    // 2. classroomId로 매칭 (타입 변환)
                    const rClassroomId = typeof r.classroomId === 'string' ? parseInt(r.classroomId, 10) : r.classroomId;
                    if (rClassroomId && rClassroomId === targetClassroomId) {
                        return true;
                    }
                    // 3. element_data에서 classroomId 확인
                    if (r.elementData) {
                        try {
                            const elementData = typeof r.elementData === 'string' 
                                ? JSON.parse(r.elementData) 
                                : r.elementData;
                            if (elementData) {
                                const dataClassroomId = typeof elementData.classroomId === 'string' 
                                    ? parseInt(elementData.classroomId, 10) 
                                    : elementData.classroomId;
                                if (dataClassroomId && dataClassroomId === targetClassroomId) {
                                    return true;
                                }
                                // referenceId도 확인
                                const dataRefId = typeof elementData.referenceId === 'string' 
                                    ? parseInt(elementData.referenceId, 10) 
                                    : elementData.referenceId;
                                if (dataRefId && dataRefId === targetClassroomId) {
                                    return true;
                                }
                            }
                        } catch (e) {
                            // 파싱 실패 시 무시
                        }
                    }
                    return false;
                }) || null;
            }
            
            if (!roomElement) {
                console.log('⚠️ 교실 요소를 찾을 수 없음 - classroomId:', targetClassroomId, '(원본:', ap.classroomId, ')', '교실명:', ap.classroomName, 'AP ID:', ap.apId);
                
                // 디버깅: 모든 교실 요소 출력
                const allRooms = this.core.state.elements.filter(e => e.elementType === 'room');
                console.log('📚 현재 로드된 교실들:', allRooms.map(r => {
                    const rRefId = typeof r.referenceId === 'string' ? parseInt(r.referenceId, 10) : r.referenceId;
                    const rClassroomId = typeof r.classroomId === 'string' ? parseInt(r.classroomId, 10) : r.classroomId;
                    return {
                    id: r.id,
                        referenceId: rRefId,
                        classroomId: rClassroomId,
                        label: r.label,
                        elementData: r.elementData ? (typeof r.elementData === 'string' ? JSON.parse(r.elementData) : r.elementData) : null
                    };
                }));
                
                // 매칭 가능한 교실이 있는지 확인
                const possibleMatch = allRooms.find(r => {
                    const rRefId = typeof r.referenceId === 'string' ? parseInt(r.referenceId, 10) : r.referenceId;
                    return rRefId && Math.abs(rRefId - targetClassroomId) < 10; // 10 이내 차이
                });
                if (possibleMatch) {
                    console.log('💡 유사한 교실 발견 (차이:', Math.abs((typeof possibleMatch.referenceId === 'string' ? parseInt(possibleMatch.referenceId, 10) : possibleMatch.referenceId) - targetClassroomId), '):', possibleMatch);
                }
                
                skippedCount++;
                return;
            }
            
            console.log('✅ 교실 요소 찾음:', {
                apId: ap.apId,
                classroomId: targetClassroomId,
                roomId: roomElement.id,
                roomLabel: roomElement.label,
                roomReferenceId: roomElement.referenceId
            });
            
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
            
            const DEFAULT_RADIUS = 20;
            const DEFAULT_SIZE = DEFAULT_RADIUS * 2;
            
            let backgroundColor = '#ef4444';
            let borderColor = '#000000';
            let shapeType = 'circle';
            let centerX;
            let centerY;
            let radius = DEFAULT_RADIUS;
            let width = DEFAULT_SIZE;
            let height = DEFAULT_SIZE;
            
            let letterColor = '#000000'; // circle-l 기본 색상
            
            if (savedPosition) {
                backgroundColor = savedPosition.backgroundColor || backgroundColor;
                borderColor = savedPosition.borderColor || borderColor;
                shapeType = savedPosition.shapeType || 'circle';
                letterColor = savedPosition.letterColor || letterColor; // letterColor 추가
                
                // savedPosition.x, y는 교실 기준 상대 좌표(오프셋)
                const offsetX = savedPosition.x || 0;
                const offsetY = savedPosition.y || 0;
                
                if (shapeType === 'circle' || shapeType === 'circle-l') {
                    radius = savedPosition.radius || DEFAULT_RADIUS;
                    width = radius * 2;
                    height = radius * 2;
                } else {
                    width = savedPosition.width || DEFAULT_SIZE;
                    height = savedPosition.height || DEFAULT_SIZE;
                }
                
                // 교실 위치 + 상대 좌표 = 실제 중앙 좌표
                centerX = roomElement.xCoordinate + offsetX;
                centerY = roomElement.yCoordinate + offsetY;
                
                console.log('✅ 저장된 AP 위치 사용 (교실 기준):', ap.apId, {
                    shapeType,
                    offsetX,
                    offsetY,
                    centerX,
                    centerY,
                    width,
                    height,
                    letterColor
                });
            } else {
                // 기본 위치 (교실 중앙 살짝 아래) - 20px 아래로 이동
                shapeType = 'circle';
                const baseCenterX = roomElement.xCoordinate + roomElement.width / 2;
                const baseCenterY = roomElement.yCoordinate + roomElement.height / 2 + 30;
                centerX = baseCenterX;
                centerY = baseCenterY;
                
                // 기본 위치도 offset으로 계산하여 저장
                const defaultOffsetX = centerX - roomElement.xCoordinate;
                const defaultOffsetY = centerY - roomElement.yCoordinate;
                
                // savedApPositions에 기본 위치 저장 (다음 로드 시에도 유지)
                const apIdKey = String(ap.apId);
                if (!this.savedApPositions[apIdKey]) {
                    this.savedApPositions[apIdKey] = {
                        x: defaultOffsetX,
                        y: defaultOffsetY,
                        backgroundColor,
                        borderColor,
                        shapeType,
                        width,
                        height,
                        radius: (shapeType === 'circle' || shapeType === 'circle-l') ? radius : null
                    };
                    console.log('💾 기본 위치를 savedApPositions에 저장:', {
                        apId: ap.apId,
                        offsetX: defaultOffsetX,
                        offsetY: defaultOffsetY
                    });
                }
            }
            
            // 좌상단 좌표 계산
            const xCoordinate = centerX - width / 2;
            const yCoordinate = centerY - height / 2;
            
            const apElement = {
                // 타입은 히트테스트에 사용됨 (선택 가능하도록 필수)
                type: 'wireless_ap',
                elementType: 'wireless_ap',
                xCoordinate,
                yCoordinate,
                width,
                height,
                radius: (shapeType === 'circle' || shapeType === 'circle-l') ? radius : null,
                shapeType,
                borderColor,
                backgroundColor,
                letterColor: (shapeType === 'circle-l') ? letterColor : undefined, // circle-l일 때만 letterColor 추가
                borderWidth: 2,
                referenceId: ap.apId,
                parentElementId: roomElement.id,
                label: ap.newLabelNumber,
                zIndex: 1000, // 높은 우선순위
                pageNumber: roomElement.pageNumber != null ? roomElement.pageNumber : (this.core.currentPage || 1) // 교실과 같은 페이지에 배치
            };
            
            console.log('🔍 AP 요소 생성 시도:', {
                apId: ap.apId,
                label: ap.newLabelNumber,
                classroomId: ap.classroomId,
                roomId: roomElement.id,
                x: xCoordinate,
                y: yCoordinate,
                width,
                height,
                shapeType,
                pageNumber: apElement.pageNumber
            });
            
            const createdElement = this.elementManager.createElement('wireless_ap', apElement);
            
            // 생성 확인
            const verifyElement = this.core.state.elements.find(e => e.id === createdElement.id);
            if (!verifyElement) {
                console.error('❌ AP 요소가 Core state에 추가되지 않음:', ap.apId);
            } else {
                console.log('✅ AP 요소 Core state 확인:', verifyElement.id, verifyElement.elementType);
            }
            
            // 저장 위치 확인 및 업데이트 (savedPosition이 없는 경우에만)
            // apId를 문자열로 변환하여 키 일치 보장
            const apIdKey = String(ap.apId);
            if (!this.savedApPositions[apIdKey]) {
                // 교실 기준 상대 좌표로 저장 (교실이 이동해도 AP가 함께 이동하도록)
                const offsetX = centerX - roomElement.xCoordinate;
                const offsetY = centerY - roomElement.yCoordinate;
                this.savedApPositions[apIdKey] = {
                    x: offsetX,
                    y: offsetY,
                    backgroundColor,
                    borderColor,
                    shapeType,
                    width,
                    height,
                    radius: (shapeType === 'circle' || shapeType === 'circle-l') ? radius : null
                };
                console.log('💾 새로 생성된 AP 위치를 savedApPositions에 저장:', {
                    apId: ap.apId,
                    offsetX,
                    offsetY
                });
            }
            
            createdCount++;
            console.log('✅ AP 생성 완료:', ap.apId, ap.newLabelNumber, '교실:', roomElement.label || roomElement.id, '요소 ID:', createdElement.id);
        });
        
        console.log('✅ 무선AP 렌더링 완료: 생성', createdCount, '개, 스킵', skippedCount, '개');
        
        // 생성된 AP 요소 확인
        const allApElements = this.core.state.elements.filter(e => e.elementType === 'wireless_ap');
        console.log('📊 Core state의 무선AP 요소 개수:', allApElements.length);
        if (allApElements.length > 0) {
            console.log('📊 무선AP 요소 샘플:', allApElements.slice(0, 3).map(ap => ({
                id: ap.id,
                referenceId: ap.referenceId,
                x: ap.xCoordinate,
                y: ap.yCoordinate,
                shapeType: ap.shapeType,
                pageNumber: ap.pageNumber
            })));
        }
        
        // 강제 렌더링
        this.core.markDirty();
        this.core.render && this.core.render();
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
            this.clearSelection();
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
        this.updateShapeButtons();
    }

    /**
     * 무선AP 모양 변경 버튼 상태 업데이트
     */
    updateShapeButtons() {
        if (!this.shapeButtons || this.shapeButtons.length === 0) {
            this.shapeButtons = Array.from(document.querySelectorAll('.shape-btn'));
        }
        
        const isApSelected = !!this.selectedElement && this.selectedElement.elementType === 'wireless_ap';
        const currentShape = isApSelected ? (this.selectedElement.shapeType || 'circle') : null;
        
        this.shapeButtons.forEach(btn => {
            btn.disabled = !isApSelected;
            btn.classList.toggle('active', isApSelected && btn.dataset.shape === currentShape);
        });
    }
    
    /**
     * 선택된 무선AP 모양 변경
     */
    changeSelectedElementShape(shape) {
        if (!this.selectedElement || this.selectedElement.elementType !== 'wireless_ap') {
            this.uiManager.showNotification('무선AP를 먼저 선택하세요', 'warning');
            return;
        }
        
        const currentShape = this.selectedElement.shapeType || 'circle';
        if (shape === currentShape) {
            return;
        }
        
        const DEFAULT_SIZE = 40;
        const currentWidth = this.selectedElement.width || (this.selectedElement.radius ? this.selectedElement.radius * 2 : DEFAULT_SIZE);
        const currentHeight = this.selectedElement.height || (this.selectedElement.radius ? this.selectedElement.radius * 2 : DEFAULT_SIZE);
        const centerX = this.selectedElement.xCoordinate + currentWidth / 2;
        const centerY = this.selectedElement.yCoordinate + currentHeight / 2;
        
        let updates = { shapeType: shape };
        
        if (shape === 'circle' || shape === 'circle-l') {
            const radius = this.selectedElement.radius || Math.max(currentWidth, currentHeight) / 2 || (DEFAULT_SIZE / 2);
            const width = radius * 2;
            const height = radius * 2;
            updates = {
                ...updates,
                radius,
                width,
                height,
                xCoordinate: centerX - width / 2,
                yCoordinate: centerY - height / 2
            };
            // circle-l의 경우 letterColor 기본값 설정
            if (shape === 'circle-l' && !this.selectedElement.letterColor) {
                updates.letterColor = '#000000';
            }
        } else {
            const size = Math.max(currentWidth, currentHeight, DEFAULT_SIZE);
            const width = size;
            const height = shape === 'triangle' ? size : size;
            updates = {
                ...updates,
                radius: null,
                width,
                height,
                xCoordinate: centerX - width / 2,
                yCoordinate: centerY - height / 2
            };
        }
        
        this.elementManager.updateElement(this.selectedElement.id, updates);
        const updatedElement = this.elementManager.findElement(this.selectedElement.id);
        if (updatedElement) {
            this.selectedElement = updatedElement;
        }
        
        if (this.selectedElement && this.selectedElement.referenceId && this.savedApPositions) {
            // referenceId를 문자열로 변환하여 키 일치 보장
            const refId = String(this.selectedElement.referenceId);
            const existing = this.savedApPositions[refId] || {};
            
            // 교실 요소 찾기 (renderWirelessAps와 동일한 로직 사용)
            const parentElementId = this.selectedElement.parentElementId;
            let roomElement = null;
            
            // 1. parentElementId로 직접 찾기
            if (parentElementId) {
                roomElement = this.elementManager.findElement(parentElementId);
            }
            
            // 2. parentElementId로 찾지 못한 경우, 무선AP 데이터에서 classroomId 찾기
            if (!roomElement) {
                // apId도 숫자일 수 있으므로 타입 변환하여 비교
                const apData = this.wirelessAps.find(ap => String(ap.apId) === refId || ap.apId === this.selectedElement.referenceId);
                if (apData && apData.classroomId) {
                    const targetClassroomId = typeof apData.classroomId === 'string' 
                        ? parseInt(apData.classroomId, 10) 
                        : apData.classroomId;
                    
                    if (targetClassroomId && !isNaN(targetClassroomId)) {
                        // referenceId로 찾기
                        roomElement = this.elementManager.findElementByReferenceId(targetClassroomId);
                        
                        // referenceId로 찾지 못한 경우 다른 방법으로 찾기
                        if (!roomElement) {
                            const allRooms = this.core.state.elements.filter(e => e.elementType === 'room');
                            roomElement = allRooms.find(r => {
                                // 1. referenceId로 매칭 (타입 변환)
                                const rRefId = typeof r.referenceId === 'string' ? parseInt(r.referenceId, 10) : r.referenceId;
                                if (rRefId && rRefId === targetClassroomId) {
                                    return true;
                                }
                                // 2. classroomId로 매칭 (타입 변환)
                                const rClassroomId = typeof r.classroomId === 'string' ? parseInt(r.classroomId, 10) : r.classroomId;
                                if (rClassroomId && rClassroomId === targetClassroomId) {
                                    return true;
                                }
                                // 3. element_data에서 classroomId 확인
                                if (r.elementData) {
                                    try {
                                        const elementData = typeof r.elementData === 'string' 
                                            ? JSON.parse(r.elementData) 
                                            : r.elementData;
                                        if (elementData) {
                                            const dataClassroomId = typeof elementData.classroomId === 'string' 
                                                ? parseInt(elementData.classroomId, 10) 
                                                : elementData.classroomId;
                                            if (dataClassroomId && dataClassroomId === targetClassroomId) {
                                                return true;
                                            }
                                            // referenceId도 확인
                                            const dataRefId = typeof elementData.referenceId === 'string' 
                                                ? parseInt(elementData.referenceId, 10) 
                                                : elementData.referenceId;
                                            if (dataRefId && dataRefId === targetClassroomId) {
                                                return true;
                                            }
                                        }
                                    } catch (e) {
                                        // 파싱 실패 시 무시
                                    }
                                }
                                return false;
                            }) || null;
                        }
                    }
                }
            }
            
            // offset 계산 (교실 기준 상대 좌표)
            let offsetX = existing.x || 0;
            let offsetY = existing.y || 0;
            
            if (roomElement) {
                offsetX = centerX - roomElement.xCoordinate;
                offsetY = centerY - roomElement.yCoordinate;
                console.log('✅ 교실 요소 찾음, offset 계산:', {
                    apId: refId,
                    roomId: roomElement.id,
                    centerX,
                    centerY,
                    roomX: roomElement.xCoordinate,
                    roomY: roomElement.yCoordinate,
                    offsetX,
                    offsetY
                });
            } else {
                // 교실 요소를 찾지 못한 경우, 기존 값이 offset인지 절대 좌표인지 확인
                const existingX = existing.x || 0;
                const existingY = existing.y || 0;
                
                // 절대 좌표인지 확인 (1000 이상이면 절대 좌표로 간주)
                if (Math.abs(existingX) > 1000 || Math.abs(existingY) > 1000) {
                    // 절대 좌표인 경우, 현재 AP의 parentElementId를 사용해서 교실을 찾아보기
                    // parentElementId가 있으면 그 요소를 교실로 간주
                    if (this.selectedElement.parentElementId) {
                        const parentElement = this.elementManager.findElement(this.selectedElement.parentElementId);
                        if (parentElement && parentElement.elementType === 'room') {
                            offsetX = centerX - parentElement.xCoordinate;
                            offsetY = centerY - parentElement.yCoordinate;
                            console.log('✅ parentElementId로 교실 찾음, offset 계산:', {
                                apId: refId,
                                parentElementId: this.selectedElement.parentElementId,
                                centerX,
                                centerY,
                                roomX: parentElement.xCoordinate,
                                roomY: parentElement.yCoordinate,
                                offsetX,
                                offsetY
                            });
                        } else {
                            // parentElement가 교실이 아니면 기존 offset 유지 (0이 아닌 경우)
                            if (Math.abs(existingX) < 1000 && Math.abs(existingY) < 1000) {
                                offsetX = existingX;
                                offsetY = existingY;
                            } else {
                                // 절대 좌표이고 교실을 찾을 수 없으면 기본값 사용
                                offsetX = 140; // 기본 offset (교실 중앙 살짝 아래)
                                offsetY = 120;
                            }
                            console.warn('⚠️ 교실 요소를 찾을 수 없음, 기본 offset 사용:', {
                                apId: refId,
                                parentElementId: this.selectedElement.parentElementId,
                                offsetX,
                                offsetY
                            });
                        }
                    } else {
                        // parentElementId도 없으면 기본값 사용
                        offsetX = 140; // 기본 offset (교실 중앙 살짝 아래)
                        offsetY = 120;
                        console.warn('⚠️ 교실 요소를 찾을 수 없음, 기본 offset 사용:', {
                            apId: refId,
                            parentElementId: null,
                            offsetX,
                            offsetY
                        });
                    }
                } else {
                    // 기존 값이 offset인 경우 그대로 사용
                    offsetX = existingX;
                    offsetY = existingY;
                    console.warn('⚠️ 교실 요소를 찾을 수 없음, 기존 offset 사용:', {
                        apId: refId,
                        parentElementId,
                        existingOffset: { x: existingX, y: existingY }
                    });
                }
            }
            
            this.savedApPositions[refId] = {
                ...existing,
                shapeType: shape,
                x: offsetX,  // 교실 기준 상대 좌표 (offset)
                y: offsetY,  // 교실 기준 상대 좌표 (offset)
                width: updates.width,
                height: updates.height,
                radius: (shape === 'circle' || shape === 'circle-l') ? updates.radius : null,
                backgroundColor: existing.backgroundColor ?? this.selectedElement.backgroundColor,
                borderColor: existing.borderColor ?? this.selectedElement.borderColor,
                letterColor: existing.letterColor ?? this.selectedElement.letterColor
            };
        }
        
        this.core.markDirty();
        this.updateShapeButtons();
        this.uiManager.showNotification('무선AP 모양이 변경되었습니다.', 'success');
    }
    
    /**
     * 선택 해제
     */
    clearSelection() {
        if (this.selectedElement) {
            console.log('🧹 선택 해제:', this.selectedElement);
        }
        this.selectedElement = null;
        this.core.setState({ selectedElements: [] });
        this.updateShapeButtons();
    }
    
    /**
     * 선택된 요소 색상 변경 (AP 또는 MDF)
     */
    changeSelectedElementColor(color) {
        if (!this.selectedElement) {
            this.uiManager.showNotification('먼저 무선AP 또는 MDF를 선택하세요', 'warning');
            return;
        }
        
        const shapeType = this.selectedElement.shapeType || 'circle';
        let updates = {};
        
        // circle-l 모양인 경우: 테두리 색상과 L 색상 모두 변경
        if (shapeType === 'circle-l') {
            updates.borderColor = color;
            updates.letterColor = color;
        } else {
            // 다른 모양: backgroundColor 변경 (기존 동작)
            updates.backgroundColor = color;
        }
        
        // 요소 속성 업데이트
        Object.assign(this.selectedElement, updates);
        
        // Core 업데이트
        this.elementManager.updateElement(this.selectedElement.id, updates);
        const updatedElement = this.elementManager.findElement(this.selectedElement.id);
        if (updatedElement) {
            this.selectedElement = updatedElement;
        }
        if (this.selectedElement && this.selectedElement.referenceId && this.savedApPositions) {
            // referenceId를 문자열로 변환하여 키 일치 보장
            const refId = String(this.selectedElement.referenceId);
            const existing = this.savedApPositions[refId] || {};
            this.savedApPositions[refId] = {
                ...existing,
                ...updates
            };
        }
        this.core.markDirty();
        this.updateShapeButtons();
        
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
            
            // 기존 savedApPositions 백업 (변경 사항 보존) - 깊은 복사
            // FloorPlanApp 레벨에서 관리하므로 직접 참조
            const existingSavedPositions = this.savedApPositions ? JSON.parse(JSON.stringify(this.savedApPositions)) : {};
            
            console.log('💾 기존 변경 사항 백업:', Object.keys(existingSavedPositions).length, '개');
            
            // 새로 초기화 (FloorPlanApp 레벨에서도 초기화)
            this.savedApPositions = {};
            if (window.floorPlanApp) {
                window.floorPlanApp.savedApPositions = this.savedApPositions;
            }
            
            // 평면도 데이터 로드
            const response = await fetch(`/floorplan/api/schools/${schoolId}`);
            const result = await response.json();
            
            if (!result.success || !result.data || !result.data.elements) {
                console.log('ℹ️ 저장된 AP/MDF 데이터 없음');
                // 서버 데이터가 없어도 기존 변경 사항은 유지
                this.savedApPositions = existingSavedPositions;
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
            // 무선AP 위치는 "교실 기준 좌표"로 관리한다.
            // - 백엔드에서 전달되는 xCoordinate, yCoordinate는 교실 기준 좌표(상대 좌표)로 간주한다.
            // - 렌더링 시에는 항상 교실 위치(roomElement.xCoordinate, yCoordinate)에 상대 좌표를 더해 실제 위치를 계산한다.
            savedAps.forEach(apData => {
                if (apData.referenceId) {
                    // referenceId를 문자열로 변환하여 키 일치 보장
                    const apIdKey = String(apData.referenceId);
                    
                    // 기존 변경 사항이 있으면 우선 사용 (서버 데이터보다 우선)
                    // referenceId가 문자열일 수도 있고 숫자일 수도 있으므로 둘 다 확인
                    const existingPosition = existingSavedPositions[apIdKey] || existingSavedPositions[String(apData.referenceId)] || existingSavedPositions[apData.referenceId];
                    if (existingPosition) {
                        // 기존 변경 사항을 그대로 유지 (서버 데이터와 병합하지 않음)
                        // 깊은 복사로 보존
                        this.savedApPositions[apIdKey] = JSON.parse(JSON.stringify(existingPosition));
                        console.log('💾 기존 변경 사항 유지 (AP ID:', apIdKey, '):', this.savedApPositions[apIdKey]);
                        return;
                    }
                    
                    const shapeType = apData.shapeType || 'circle';
                    let width = apData.width;
                    let height = apData.height;
                    
                    // circle 또는 circle-l인 경우 radius로부터 width/height 계산
                    if ((shapeType === 'circle' || shapeType === 'circle-l') && apData.radius) {
                        width = apData.radius * 2;
                        height = apData.radius * 2;
                    } else {
                        width = width || 40;
                        height = height || 40;
                    }
                    
                    // 서버에서 받은 좌표는 절대 좌표(중앙 좌표)이므로, 교실 기준 offset으로 변환 필요
                    // 먼저 해당 AP의 교실을 찾아야 함
                    // this.wirelessAps에서 AP 정보를 찾아 실제 classroomId를 확인
                    const apInfo = this.wirelessAps.find(ap => ap.apId === apData.referenceId);
                    const apClassroomId = apInfo ? (typeof apInfo.classroomId === 'string' 
                        ? parseInt(apInfo.classroomId, 10) 
                        : apInfo.classroomId) : (typeof apData.classroomId === 'string' 
                        ? parseInt(apData.classroomId, 10) 
                        : apData.classroomId);
                    
                    let offsetX = 0;
                    let offsetY = 0;
                    
                    if (apClassroomId && apData.xCoordinate != null && apData.yCoordinate != null) {
                        // 교실 요소 찾기 (renderWirelessAps와 동일한 로직 사용)
                        // 1. core.state.elements에서 찾기
                        let allRooms = this.core.state.elements.filter(e => e.elementType === 'room');
                        let apRoom = allRooms.find(r => {
                            const rRefId = typeof r.referenceId === 'string' ? parseInt(r.referenceId, 10) : r.referenceId;
                            const rClassroomId = typeof r.classroomId === 'string' ? parseInt(r.classroomId, 10) : r.classroomId;
                            // 1. referenceId로 매칭
                            if (rRefId && rRefId === apClassroomId) return true;
                            // 2. classroomId로 매칭
                            if (rClassroomId && rClassroomId === apClassroomId) return true;
                            // 3. element_data에서 classroomId 확인
                            if (r.elementData) {
                                try {
                                    const elementData = typeof r.elementData === 'string' ? JSON.parse(r.elementData) : r.elementData;
                                    if (elementData) {
                                        const dataClassroomId = typeof elementData.classroomId === 'string' 
                                            ? parseInt(elementData.classroomId, 10) 
                                            : elementData.classroomId;
                                        if (dataClassroomId && dataClassroomId === apClassroomId) return true;
                                        // referenceId도 확인
                                        const dataRefId = typeof elementData.referenceId === 'string' 
                                            ? parseInt(elementData.referenceId, 10) 
                                            : elementData.referenceId;
                                        if (dataRefId && dataRefId === apClassroomId) return true;
                                    }
                                } catch (e) {}
                            }
                            return false;
                        });
                        
                        // 2. core.state.elements에서 찾지 못한 경우, 서버에서 받은 elements에서 찾기
                        if (!apRoom) {
                            const serverRooms = elements.filter(el => el.elementType === 'room');
                            const serverRoom = serverRooms.find(r => {
                                const rRefId = typeof r.referenceId === 'string' ? parseInt(r.referenceId, 10) : r.referenceId;
                                const rClassroomId = typeof r.classroomId === 'string' ? parseInt(r.classroomId, 10) : r.classroomId;
                                // 1. referenceId로 매칭
                                if (rRefId && rRefId === apClassroomId) return true;
                                // 2. classroomId로 매칭
                                if (rClassroomId && rClassroomId === apClassroomId) return true;
                                // 3. element_data에서 classroomId 확인
                                if (r.elementData) {
                                    try {
                                        const elementData = typeof r.elementData === 'string' ? JSON.parse(r.elementData) : r.elementData;
                                        if (elementData) {
                                            const dataClassroomId = typeof elementData.classroomId === 'string' 
                                                ? parseInt(elementData.classroomId, 10) 
                                                : elementData.classroomId;
                                            if (dataClassroomId && dataClassroomId === apClassroomId) return true;
                                            // referenceId도 확인
                                            const dataRefId = typeof elementData.referenceId === 'string' 
                                                ? parseInt(elementData.referenceId, 10) 
                                                : elementData.referenceId;
                                            if (dataRefId && dataRefId === apClassroomId) return true;
                                        }
                                    } catch (e) {}
                                }
                                return false;
                            });
                            
                            if (serverRoom) {
                                // 서버에서 받은 교실 요소를 core.state.elements 형식으로 변환
                                apRoom = {
                                    id: serverRoom.id,
                                    elementType: serverRoom.elementType,
                                    xCoordinate: serverRoom.xCoordinate,
                                    yCoordinate: serverRoom.yCoordinate,
                                    width: serverRoom.width,
                                    height: serverRoom.height,
                                    referenceId: serverRoom.referenceId,
                                    classroomId: serverRoom.classroomId,
                                    pageNumber: serverRoom.pageNumber,
                                    elementData: serverRoom.elementData
                                };
                                console.log('📥 서버에서 교실 요소 찾음 (core.state.elements에 없음):', {
                                    apId: apData.referenceId,
                                    classroomId: apClassroomId,
                                    roomId: apRoom.id,
                                    roomPageNumber: apRoom.pageNumber
                                });
                            }
                        }
                        
                        if (apRoom) {
                            // 절대 좌표(중앙)를 교실 기준 offset으로 변환
                            // 서버에 저장된 좌표는 중앙 좌표이므로, 교실의 좌상단 좌표를 빼서 offset 계산
                            offsetX = apData.xCoordinate - apRoom.xCoordinate;
                            offsetY = apData.yCoordinate - apRoom.yCoordinate;
                            console.log('🔄 절대 좌표를 offset으로 변환:', {
                                apId: apData.referenceId,
                                pageNumber: apRoom.pageNumber,
                                absoluteX: apData.xCoordinate,
                                absoluteY: apData.yCoordinate,
                                roomX: apRoom.xCoordinate,
                                roomY: apRoom.yCoordinate,
                                offsetX,
                                offsetY
                            });
                        } else {
                            // 교실을 찾지 못한 경우, 절대 좌표가 작으면 offset으로 간주
                            if (apData.xCoordinate < 5000 && apData.yCoordinate < 5000) {
                                offsetX = apData.xCoordinate;
                                offsetY = apData.yCoordinate;
                                console.log('⚠️ 교실을 찾지 못함, 작은 값이므로 offset으로 간주:', {
                                    apId: apData.referenceId,
                                    classroomId: apClassroomId,
                                    offsetX,
                                    offsetY,
                                    availableRooms: allRooms.map(r => ({
                                        id: r.referenceId,
                                        classroomId: r.classroomId,
                                        pageNumber: r.pageNumber
                                    }))
                                });
                            } else {
                                // 큰 값이면 절대 좌표일 가능성이 높지만, 교실을 찾지 못했으므로 기본값 사용
                                console.warn('⚠️ 교실을 찾지 못하고 좌표가 큼, 기본 offset 사용:', {
                                    apId: apData.referenceId,
                                    classroomId: apClassroomId,
                                    absoluteX: apData.xCoordinate,
                                    absoluteY: apData.yCoordinate,
                                    availableRooms: allRooms.map(r => ({
                                        id: r.referenceId,
                                        classroomId: r.classroomId,
                                        pageNumber: r.pageNumber
                                    }))
                                });
                            }
                        }
                    }
                    
                    // apIdKey는 이미 위에서 선언되었으므로 재사용
                    this.savedApPositions[apIdKey] = {
                        // 교실 기준 상대 좌표 (offset)
                        x: offsetX,
                        y: offsetY,
                        backgroundColor: apData.backgroundColor,
                        borderColor: apData.borderColor,
                        letterColor: apData.letterColor || '#000000',
                        shapeType: shapeType,
                        width: width,
                        height: height,
                        radius: (shapeType === 'circle' || shapeType === 'circle-l') ? (apData.radius || width / 2) : null
                    };
                }
            });
            
            // 기존 변경 사항 중 서버에 없는 AP도 유지 (새로 생성된 AP)
            Object.keys(existingSavedPositions).forEach(apId => {
                // apId를 문자열로 변환하여 키 일치 보장
                const apIdKey = String(apId);
                // 서버 데이터에서 해당 AP를 찾지 못했거나, 키가 다른 경우
                const foundInServer = savedAps.some(ap => {
                    const serverApIdKey = String(ap.referenceId);
                    return serverApIdKey === apIdKey || String(ap.referenceId) === apId;
                });
                
                if (!foundInServer || !this.savedApPositions[apIdKey]) {
                    this.savedApPositions[apIdKey] = existingSavedPositions[apId];
                    console.log('💾 새로 생성된 AP 변경 사항 유지 (AP ID:', apIdKey, '):', this.savedApPositions[apIdKey]);
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
        // apId를 문자열로 변환하여 키 일치 보장
        const apIdKey = String(apId);
        return this.savedApPositions[apIdKey] || this.savedApPositions[apId] || null;
    }
    
    /**
     * 무선AP 요소 위치 업데이트 (드래그 종료 시 호출)
     * 요소의 좌상단 좌표를 "교실 기준 상대 좌표"로 변환하여 savedApPositions에 저장
     */
    updateApPosition(element) {
        if (!element || element.elementType !== 'wireless_ap' || !element.referenceId) {
            return;
        }
        
        const width = element.width || (element.radius ? element.radius * 2 : 40);
        const height = element.height || (element.radius ? element.radius * 2 : 40);
        const centerX = element.xCoordinate + width / 2;
        const centerY = element.yCoordinate + height / 2;
        
        // 부모 교실 요소 기준 상대 좌표 계산
        const roomElement = this.core.state.elements.find(e => e.id === element.parentElementId);
        if (!roomElement) {
            console.warn('⚠️ AP 부모 교실 요소를 찾을 수 없음 - 절대 좌표로 저장됩니다.', {
                apId: element.referenceId,
                elementId: element.id
            });
            
            // 교실을 찾지 못한 경우, 기존 offset을 유지하거나 기본값 사용
            const refIdKey = String(element.referenceId);
            const existingFallback = this.savedApPositions[refIdKey] || {};
            
            // 기존 offset이 있으면 유지, 없으면 기본 offset 사용
            const defaultOffsetX = existingFallback.x != null ? existingFallback.x : 140; // 교실 중앙 살짝 아래
            const defaultOffsetY = existingFallback.y != null ? existingFallback.y : 120;
            
            this.savedApPositions[refIdKey] = {
                ...existingFallback,
                x: defaultOffsetX,
                y: defaultOffsetY,
                width: width,
                height: height,
                radius: (element.shapeType === 'circle' || element.shapeType === 'circle-l') ? (element.radius || width / 2) : null,
                shapeType: element.shapeType || existingFallback.shapeType || 'circle',
                backgroundColor: element.backgroundColor || existingFallback.backgroundColor,
                borderColor: element.borderColor || existingFallback.borderColor
            };
            console.warn('⚠️ 교실을 찾지 못함, 기본 offset 사용:', {
                apId: element.referenceId,
                offsetX: defaultOffsetX,
                offsetY: defaultOffsetY
            });
            return;
        }
        
        const offsetX = centerX - roomElement.xCoordinate;
        const offsetY = centerY - roomElement.yCoordinate;
        
        // referenceId를 문자열로 변환하여 키 일치 보장
        const refIdKey = String(element.referenceId);
        const existing = this.savedApPositions[refIdKey] || {};
        this.savedApPositions[refIdKey] = {
            ...existing,
            x: offsetX,  // 교실 기준 상대 X 좌표
            y: offsetY,  // 교실 기준 상대 Y 좌표
            width: width,
            height: height,
            radius: (element.shapeType === 'circle' || element.shapeType === 'circle-l') ? (element.radius || width / 2) : null,
            shapeType: element.shapeType || existing.shapeType || 'circle',
            backgroundColor: element.backgroundColor || existing.backgroundColor,
            borderColor: element.borderColor || existing.borderColor
        };
        
        console.log('💾 AP 위치 업데이트:', element.referenceId, {
            offsetX: offsetX.toFixed(2),
            offsetY: offsetY.toFixed(2),
            centerX: centerX.toFixed(2),
            centerY: centerY.toFixed(2),
            roomX: roomElement.xCoordinate.toFixed(2),
            roomY: roomElement.yCoordinate.toFixed(2)
        });
    }
    
    /**
     * 페이지 전환 시 호출 (main_new_v3.js에서 호출)
     */
    async onPageSwitch(pageNumber) {
        console.log(`📄 무선AP 설계 모드 - 페이지 전환: ${pageNumber}`);
        
        // core.currentPage 업데이트
        if (this.core) {
            this.core.currentPage = pageNumber;
        }
        
        // 교실 요소가 로드될 때까지 대기
        await this.waitForRoomElements();
        
        // 저장된 AP/MDF 위치 다시 로드 (모든 페이지의 교실 요소가 로드된 후)
        await this.loadSavedApMdfElements();
        
        // 현재 페이지의 교실에 맞는 AP만 다시 렌더링
        this.renderWirelessAps();
        
        // 렌더링 강제 실행
        this.core.markDirty();
        this.core.render && this.core.render();
    }
}

