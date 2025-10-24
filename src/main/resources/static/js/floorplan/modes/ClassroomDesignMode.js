/**
 * ClassroomDesignMode.js
 * 교실 설계 모드 매니저
 * 
 * 책임:
 * - 건물/교실/도형 요소 생성 및 배치
 * - 미배치 교실 관리
 * - 요소 크기 조정 및 이동
 * - 레이어 순서(z-index) 관리
 * - 캔버스 초기화
 */

export default class ClassroomDesignMode {
    constructor(core, elementManager, uiManager) {
        this.core = core;
        this.elementManager = elementManager;
        this.uiManager = uiManager;
        
        this.currentTool = null; // 'building', 'room', 'rectangle', 'circle', 'line', 'dashed-line'
        this.currentColor = '#000000';
        this.currentLineWidth = 2;
        this.currentFillColor = '#f5f5f5';
        
        this.selectedElements = [];
        this.isDrawing = false;
        this.drawStartPos = null;
        
        console.log('📐 ClassroomDesignMode 초기화');
    }
    
    /**
     * 모드 활성화
     */
    activate() {
        console.log('✅ 교실설계 모드 활성화');
        this.setupUI();
        this.bindEvents();
        
        // 모든 요소 잠금 해제
        this.unlockAllElements();
        
        // 레이어 버튼 초기 상태 설정
        this.updateLayerButtons();
        
        // 선택 상태 변경 감지를 위한 주기적 체크
        this.selectionCheckInterval = setInterval(() => {
            this.updateLayerButtons();
        }, 200); // 200ms마다 체크
        
        // 강제 렌더링
        this.core.markDirty();
    }
    
    /**
     * 모드 비활성화
     */
    deactivate() {
        console.log('❌ 교실설계 모드 비활성화');
        
        // 선택 체크 interval 정리
        if (this.selectionCheckInterval) {
            clearInterval(this.selectionCheckInterval);
            this.selectionCheckInterval = null;
        }
        
        this.unbindEvents();
        this.clearSelection();
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
                <h3>요소 생성</h3>
                <div class="tool-buttons">
                    <button class="tool-btn" data-tool="building" title="건물 추가">
                        <i class="fas fa-building"></i> 건물
                    </button>
                    <button class="tool-btn" data-tool="room" title="교실 추가">
                        <i class="fas fa-door-open"></i> 교실
                    </button>
                    <button class="tool-btn" data-tool="rectangle" title="사각형">
                        <i class="fas fa-square"></i> 사각형
                    </button>
                    <button class="tool-btn" data-tool="circle" title="원">
                        <i class="fas fa-circle"></i> 원
                    </button>
                    <button class="tool-btn" data-tool="line" title="선">
                        <i class="fas fa-minus"></i> 선
                    </button>
                    <button class="tool-btn" data-tool="dashed-line" title="점선">
                        <i class="fas fa-ellipsis-h"></i> 점선
                    </button>
                </div>
            </div>
            
            <div class="toolbar-section">
                <h3>스타일</h3>
                <div class="style-controls">
                    <label>
                        선 색상:
                        <input type="color" id="line-color" value="${this.currentColor}">
                    </label>
                    <label>
                        채우기 색상:
                        <input type="color" id="fill-color" value="${this.currentFillColor}">
                    </label>
                    <label>
                        선 두께:
                        <select id="line-width">
                            <option value="1">1px</option>
                            <option value="2" selected>2px</option>
                            <option value="3">3px</option>
                            <option value="4">4px</option>
                            <option value="5">5px</option>
                        </select>
                    </label>
                </div>
            </div>
            
            <div class="toolbar-section">
                <h3>미배치 교실</h3>
                <div id="unplaced-classrooms-list" class="unplaced-list">
                    <p class="loading">로딩 중...</p>
                </div>
            </div>
            
            <div class="toolbar-section">
                <h3>레이어 관리</h3>
                <div class="layer-controls">
                    <button id="bring-forward" title="앞으로 가져오기" disabled>
                        <i class="fas fa-arrow-up"></i> 앞으로
                    </button>
                    <button id="send-backward" title="뒤로 보내기" disabled>
                        <i class="fas fa-arrow-down"></i> 뒤로
                    </button>
                </div>
            </div>
            
            <div class="toolbar-section">
                <h3>추가 기능</h3>
                <button id="initialize-canvas" class="danger-btn">
                    <i class="fas fa-trash"></i> 캔버스 초기화
                </button>
            </div>
        `;
        
        // 이벤트 바인딩
        this.bindToolbarEvents();
    }
    
    /**
     * 툴바 이벤트 바인딩
     */
    bindToolbarEvents() {
        // 도구 선택
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.selectTool(tool);
            });
        });
        
        // 색상 변경
        const lineColorInput = document.getElementById('line-color');
        if (lineColorInput) {
            lineColorInput.addEventListener('change', (e) => {
                this.currentColor = e.target.value;
            });
        }
        
        const fillColorInput = document.getElementById('fill-color');
        if (fillColorInput) {
            fillColorInput.addEventListener('change', (e) => {
                this.currentFillColor = e.target.value;
            });
        }
        
        // 선 두께 변경
        const lineWidthSelect = document.getElementById('line-width');
        if (lineWidthSelect) {
            lineWidthSelect.addEventListener('change', (e) => {
                this.currentLineWidth = parseInt(e.target.value);
            });
        }
        
        // 레이어 관리
        const bringForward = document.getElementById('bring-forward');
        if (bringForward) {
            bringForward.addEventListener('click', () => this.bringForward());
        }
        
        const sendBackward = document.getElementById('send-backward');
        if (sendBackward) {
            sendBackward.addEventListener('click', () => this.sendBackward());
        }
        
        // 캔버스 초기화
        const initBtn = document.getElementById('initialize-canvas');
        if (initBtn) {
            initBtn.addEventListener('click', () => this.initializeCanvas());
        }
    }
    
    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        this.canvasClickHandler = (e) => this.handleCanvasClick(e);
        this.canvasMouseMoveHandler = (e) => this.handleCanvasMouseMove(e);
        this.canvasMouseUpHandler = (e) => this.handleCanvasMouseUp(e);
        
        const canvas = this.core.canvas;
        canvas.addEventListener('click', this.canvasClickHandler);
        canvas.addEventListener('mousemove', this.canvasMouseMoveHandler);
        canvas.addEventListener('mouseup', this.canvasMouseUpHandler);
    }
    
    /**
     * 이벤트 해제
     */
    unbindEvents() {
        const canvas = this.core.canvas;
        if (this.canvasClickHandler) {
            canvas.removeEventListener('click', this.canvasClickHandler);
        }
        if (this.canvasMouseMoveHandler) {
            canvas.removeEventListener('mousemove', this.canvasMouseMoveHandler);
        }
        if (this.canvasMouseUpHandler) {
            canvas.removeEventListener('mouseup', this.canvasMouseUpHandler);
        }
    }
    
    /**
     * 도구 선택
     */
    selectTool(tool) {
        this.currentTool = tool;
        
        // UI 업데이트
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active');
        
        // 커서 스타일 변경
        if (this.currentTool) {
            this.core.canvas.style.cursor = 'crosshair';
        } else {
            this.core.canvas.style.cursor = 'default';
        }
        
        console.log(`🔧 도구 선택: ${tool}`);
    }
    
    /**
     * 캔버스 클릭 처리
     */
    handleCanvasClick(e) {
        if (!this.currentTool) return;
        
        const rect = this.core.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 화면 좌표를 캔버스 좌표로 변환
        const canvasPos = this.core.screenToCanvas(x, y);
        
        // 캔버스 경계 체크
        if (!this.isWithinCanvasBounds(canvasPos.x, canvasPos.y)) {
            this.uiManager.showNotification('경고', '캔버스 영역 내에만 요소를 생성할 수 있습니다.', 'warning');
            return;
        }
        
        if (this.currentTool === 'building') {
            this.createBuilding(canvasPos.x, canvasPos.y);
        } else if (this.currentTool === 'room') {
            this.createRoom(canvasPos.x, canvasPos.y);
        } else if (['rectangle', 'circle', 'line', 'dashed-line'].includes(this.currentTool)) {
            this.startDrawingShape(canvasPos.x, canvasPos.y);
        }
    }
    
    /**
     * 캔버스 경계 내부인지 확인
     */
    isWithinCanvasBounds(x, y, width = 0, height = 0) {
        const canvasWidth = this.core.state.canvasWidth;
        const canvasHeight = this.core.state.canvasHeight;
        
        return x >= 0 && y >= 0 && 
               (x + width) <= canvasWidth && 
               (y + height) <= canvasHeight;
    }
    
    /**
     * 캔버스 마우스 이동 처리
     */
    handleCanvasMouseMove(e) {
        if (!this.isDrawing) return;
        
        const rect = this.core.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const canvasPos = this.core.screenToCanvas(x, y);
        
        // 도형 프리뷰 업데이트
        this.updateShapePreview(canvasPos.x, canvasPos.y);
    }
    
    /**
     * 캔버스 마우스 업 처리
     */
    handleCanvasMouseUp(e) {
        if (!this.isDrawing) return;
        
        const rect = this.core.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const canvasPos = this.core.screenToCanvas(x, y);
        
        this.finishDrawingShape(canvasPos.x, canvasPos.y);
    }
    
    /**
     * 건물 생성
     */
    createBuilding(x, y) {
        const name = prompt('건물 이름을 입력하세요:', '본관');
        if (!name) return;
        
        // 건물 요소 생성 (크기 5배)
        const buildingWidth = 400;
        const buildingHeight = 750;
        
        const building = this.elementManager.createElement('building', {
            xCoordinate: x,
            yCoordinate: y,
            width: buildingWidth,
            height: buildingHeight,
            label: name,
            borderColor: '#000000',  // 검정 테두리
            backgroundColor: '#ffffff',  // 흰색 배경
            borderWidth: this.currentLineWidth
        });
        
        // 이름박스 자동 생성 (건물 상단 중앙)
        const nameBoxWidth = 150;
        const nameBoxHeight = 40;
        this.elementManager.createElement('name_box', {
            xCoordinate: x + (buildingWidth - nameBoxWidth) / 2,  // 중앙 정렬
            yCoordinate: y + 20,  // 상단에서 20px 아래
            width: nameBoxWidth,
            height: nameBoxHeight,
            label: name,
            backgroundColor: '#ffffff',
            borderColor: '#000000',
            borderWidth: 2,
            fontSize: 16,
            parentElementId: building.id,
            zIndex: (building.zIndex || 0) + 1  // 부모보다 앞에 위치 (클릭 가능하도록)
        });
        
        this.selectTool(null);
        
        console.log('🏢 건물 생성:', name);
    }
    
    /**
     * 교실 생성
     */
    createRoom(x, y) {
        const name = prompt('교실 이름을 입력하세요:', '3-1');
        if (!name) return;
        
        // 교실 요소 생성
        const roomWidth = 120;
        const roomHeight = 80;
        
        const room = this.elementManager.createElement('room', {
            xCoordinate: x,
            yCoordinate: y,
            width: roomWidth,
            height: roomHeight,
            label: name,
            borderColor: '#000000',  // 검정 테두리
            backgroundColor: '#ffffff',  // 흰색 배경
            borderWidth: this.currentLineWidth
        });
        
        // 이름박스 자동 생성 (교실 상단 중앙)
        const nameBoxWidth = 80;
        const nameBoxHeight = 25;
        this.elementManager.createElement('name_box', {
            xCoordinate: x + (roomWidth - nameBoxWidth) / 2,  // 중앙 정렬
            yCoordinate: y + 5,  // 상단에서 5px 아래
            width: nameBoxWidth,
            height: nameBoxHeight,
            label: name,
            backgroundColor: '#ffffff',
            borderColor: '#000000',
            borderWidth: 1,
            fontSize: 12,
            parentElementId: room.id,
            zIndex: (room.zIndex || 0) + 1  // 부모보다 앞에 위치 (클릭 가능하도록)
        });
        
        this.selectTool(null);
        
        console.log('🚪 교실 생성:', name);
    }
    
    /**
     * 도형 그리기 시작
     */
    startDrawingShape(x, y) {
        this.isDrawing = true;
        this.drawStartPos = { x, y };
    }
    
    /**
     * 도형 프리뷰 업데이트
     */
    updateShapePreview(x, y) {
        // 임시 프리뷰 렌더링 (구현 예정)
        this.core.markDirty();
    }
    
    /**
     * 도형 그리기 완료
     */
    finishDrawingShape(x, y) {
        if (!this.drawStartPos) return;
        
        const width = Math.abs(x - this.drawStartPos.x);
        const height = Math.abs(y - this.drawStartPos.y);
        
        if (width < 5 || height < 5) {
            this.isDrawing = false;
            return;
        }
        
        this.elementManager.createElement('shape', {
            shapeType: this.currentTool,
            xCoordinate: Math.min(this.drawStartPos.x, x),
            yCoordinate: Math.min(this.drawStartPos.y, y),
            width: width,
            height: height,
            borderColor: this.currentColor,
            borderWidth: this.currentLineWidth,
            backgroundColor: this.currentTool === 'line' || this.currentTool === 'dashed-line' ? 'transparent' : this.currentFillColor
        });
        
        this.isDrawing = false;
        this.drawStartPos = null;
        this.selectTool(null);
        
        console.log('📐 도형 생성 완료');
    }
    
    /**
     * 다음 레이어 순서 얻기
     */
    getNextLayerOrder() {
        const elements = this.elementManager.getAllElements();
        if (elements.length === 0) return 0;
        
        const maxOrder = Math.max(...elements.map(e => e.layerOrder || 0));
        return maxOrder + 1;
    }
    
    /**
     * 앞으로 가져오기
     */
    bringForward() {
        const selectedElements = this.core.state.selectedElements || [];
        if (selectedElements.length === 0) return;
        
        selectedElements.forEach(element => {
            this.elementManager.bringForward(element.id);
        });
        
        this.core.markDirty();
        console.log('⬆️ 요소를 앞으로 이동:', selectedElements.length, '개');
    }
    
    /**
     * 뒤로 보내기
     */
    sendBackward() {
        const selectedElements = this.core.state.selectedElements || [];
        if (selectedElements.length === 0) return;
        
        selectedElements.forEach(element => {
            this.elementManager.sendBackward(element.id);
        });
        
        this.core.markDirty();
        console.log('⬇️ 요소를 뒤로 이동:', selectedElements.length, '개');
    }
    
    /**
     * 캔버스 초기화
     */
    async initializeCanvas() {
        const confirmed = confirm(
            '경고: 현재 캔버스의 모든 요소가 삭제됩니다.\n' +
            '이 작업은 되돌릴 수 없습니다.\n\n' +
            '정말 초기화하시겠습니까?'
        );
        
        if (!confirmed) return;
        
        try {
            const schoolId = this.core.currentSchoolId;
            const response = await fetch(`/floorplan/api/schools/${schoolId}/initialize`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.elementManager.clearAllElements();
                this.uiManager.showNotification('캔버스가 초기화되었습니다', 'success');
                this.core.markDirty();
            } else {
                this.uiManager.showNotification('초기화 실패: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('캔버스 초기화 오류:', error);
            this.uiManager.showNotification('초기화 중 오류가 발생했습니다', 'error');
        }
    }
    
    /**
     * 미배치 교실 로드
     */
    async loadUnplacedClassrooms(schoolId) {
        try {
            const response = await fetch(`/floorplan/api/schools/${schoolId}/unplaced-classrooms`);
            const result = await response.json();
            
            if (result.success) {
                this.renderUnplacedClassrooms(result.classrooms);
            }
        } catch (error) {
            console.error('미배치 교실 로드 오류:', error);
        }
    }
    
    /**
     * 미배치 교실 렌더링
     */
    renderUnplacedClassrooms(classrooms) {
        const container = document.getElementById('unplaced-classrooms-list');
        if (!container) return;
        
        if (classrooms.length === 0) {
            container.innerHTML = '<p class="empty">모든 교실이 배치되었습니다</p>';
            return;
        }
        
        container.innerHTML = classrooms.map(classroom => `
            <div class="unplaced-classroom-item" draggable="true" data-classroom-id="${classroom.classroomId}">
                <i class="fas fa-grip-vertical"></i>
                <span>${classroom.classroomName}</span>
            </div>
        `).join('');
        
        // 드래그 이벤트 설정
        this.setupClassroomDragEvents();
    }
    
    /**
     * 교실 드래그 이벤트 설정
     */
    setupClassroomDragEvents() {
        document.querySelectorAll('.unplaced-classroom-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('classroomId', item.dataset.classroomId);
                e.dataTransfer.effectAllowed = 'move';
            });
        });
        
        // 캔버스에 드롭 이벤트 설정
        const canvas = this.core.canvas;
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const classroomId = e.dataTransfer.getData('classroomId');
            if (classroomId) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const canvasPos = this.core.screenToCanvas(x, y);
                
                this.placeClassroom(classroomId, canvasPos.x, canvasPos.y);
            }
        });
    }
    
    /**
     * 교실 배치
     */
    placeClassroom(classroomId, x, y) {
        // 교실 정보 가져오기
        fetch(`/api/classrooms/${classroomId}`)
            .then(res => res.json())
            .then(classroom => {
                const element = {
                    type: 'room',
                    referenceId: classroom.classroomId,
                    x: x,
                    y: y,
                    width: 120,
                    height: 80,
                    name: classroom.classroomName,
                    color: '#000000',
                    fillColor: '#f5f5f5',
                    layerOrder: this.getNextLayerOrder()
                };
                
                this.elementManager.addElement(element);
                
                // 미배치 교실 목록 갱신
                this.loadUnplacedClassrooms(this.core.currentSchoolId);
                
                console.log('✅ 교실 배치:', element);
            })
            .catch(error => {
                console.error('교실 정보 로드 오류:', error);
            });
    }
    
    /**
     * 선택 해제
     */
    clearSelection() {
        this.selectedElements = [];
        this.updateLayerButtons();
    }
    
    /**
     * 모든 요소 잠금 해제
     */
    unlockAllElements() {
        const elements = this.elementManager.getAllElements();
        elements.forEach(element => {
            element.isLocked = false;
        });
    }
    
    /**
     * 도구 선택 UI 업데이트
     */
    updateToolSelection() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }
    
    /**
     * 레이어 버튼 업데이트
     */
    updateLayerButtons() {
        const bringForward = document.getElementById('bring-forward');
        const sendBackward = document.getElementById('send-backward');
        
        // core의 선택 상태 확인
        const hasSelection = this.core.state.selectedElements && this.core.state.selectedElements.length > 0;
        
        if (bringForward) bringForward.disabled = !hasSelection;
        if (sendBackward) sendBackward.disabled = !hasSelection;
        
        console.debug('🎚️ 레이어 버튼 업데이트:', hasSelection ? '활성화' : '비활성화', '(선택:', this.core.state.selectedElements.length, '개)');
    }
}

